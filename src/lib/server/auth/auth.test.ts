import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { eq } from 'drizzle-orm';

import type { Database } from '../db/client.ts';
import { createDatabase } from '../db/client.ts';
import { migrationsFolder } from '../db/config.ts';
import { runMigrations } from '../db/migrate.ts';
import { authTokens } from '../db/schema.ts';
import {
	createUser,
	createUserIfNew,
	credentialProblem,
	deleteUser,
	emailProblem,
	issueToken,
	listTokens,
	revokeToken,
	verifyLogin
} from './accounts.ts';
import { decoyHash, passwordProblem, verifyPassword } from './password.ts';
import {
	SESSION_COOKIE,
	bearerToken,
	resolveCredential,
	sessionCookieOptions,
	webCredentialExpiry
} from './session.ts';
import {
	acquireVerificationSlot,
	clearLoginFailures,
	loginBlocked,
	recordLoginFailure,
	recordRegistration,
	registrationBlocked,
	resetLoginThrottle,
	saturated
} from './throttle.ts';

/**
 * The auth surface below HTTP: everything a route calls, against a real SQLite
 * file and real scrypt. The hook that guards those routes is covered next door
 * in `../http/handle.test.ts`.
 */

const PASSWORD = 'correct horse battery';

let directory: string;
let db: Database;

beforeEach(() => {
	directory = mkdtempSync(path.join(os.tmpdir(), 'kilorep-auth-'));
	db = createDatabase(path.join(directory, 'test.db'));
	runMigrations(db, migrationsFolder);
	resetLoginThrottle();
});

afterEach(() => {
	// Closed before the directory goes, and not merely for tidiness: every case
	// here opens a `DatabaseSync` plus its WAL and shm handles, and unlinking the
	// files out from under an open connection is silent on Linux, an error on
	// Windows, and file descriptors either way.
	db.$client.close();
	rmSync(directory, { recursive: true, force: true });
});

describe('credential validation', () => {
	test('rejects a password under the floor and accepts one on it', () => {
		expect(passwordProblem('short')).toMatch(/at least 8/u);
		expect(passwordProblem('12345678')).toBeUndefined();
	});

	test('rejects an address that is not one', () => {
		expect(emailProblem('notanemail')).toBeDefined();
		expect(emailProblem('no@domain')).toBeDefined();
		expect(emailProblem('two words@example.com')).toBeDefined();
		expect(emailProblem('  Lifter@Example.com ')).toBeUndefined();
	});

	test('refuses to create an account that would fail either check', async () => {
		await expect(createUser(db, 'a@b.co', 'short')).rejects.toThrow(/at least 8/u);
		await expect(createUser(db, 'nope', PASSWORD)).rejects.toThrow(/valid address/u);
	});

	test('reports both problems through one function, so no caller can drift', () => {
		// `createUser` throws a violation and `createUserIfNew` cannot tell that
		// apart from a real failure — a route checking differently would answer
		// 500 where it meant 400.
		expect(credentialProblem('nope', PASSWORD)).toMatch(/valid address/u);
		expect(credentialProblem('a@b.co', 'short')).toMatch(/at least 8/u);
		expect(credentialProblem('a@b.co', PASSWORD)).toBeUndefined();
	});
});

describe('decoy hash', () => {
	test('parses as a stored hash and matches nothing', async () => {
		const decoy = decoyHash();

		// It has to reach the derivation to cost what a real verification costs;
		// a malformed string would be rejected by the parser in microseconds and
		// answer "no such account" by timing alone.
		expect(decoy.startsWith('scrypt$')).toBe(true);
		await expect(verifyPassword(PASSWORD, decoy)).resolves.toBe(false);
		await expect(verifyPassword('', decoy)).resolves.toBe(false);
	});

	test('is a fresh one each time it is asked for', () => {
		expect(decoyHash()).not.toBe(decoyHash());
	});
});

describe('verifyLogin', () => {
	test('accepts the right password, whatever case the address was typed in', async () => {
		const created = await createUser(db, 'lifter@example.com', PASSWORD);

		const user = await verifyLogin(db, '  LIFTER@Example.com ', PASSWORD);
		expect(user!.id).toBe(created.id);
	});

	test('refuses a wrong password', async () => {
		await createUser(db, 'lifter@example.com', PASSWORD);
		await expect(verifyLogin(db, 'lifter@example.com', 'wrong horse')).resolves.toBeNull();
	});

	test('refuses an unknown address without saying so', async () => {
		// The route answers 401 for both cases; this is the half that must not
		// answer faster, which is why the unknown path still hashes.
		await expect(verifyLogin(db, 'nobody@example.com', PASSWORD)).resolves.toBeNull();
	});
});

describe('createUserIfNew', () => {
	test('creates, then reports the duplicate rather than throwing', async () => {
		const first = await createUserIfNew(db, 'lifter@example.com', PASSWORD);
		expect(first.ok).toBe(true);

		const second = await createUserIfNew(db, 'LIFTER@example.com', PASSWORD);
		expect(second).toEqual({ ok: false, reason: 'duplicate' });
	});
});

function header(value: string): Request {
	return new Request('http://localhost/api', { headers: { authorization: value } });
}

describe('bearerToken', () => {
	test('reads the secret out of an Authorization header', () => {
		expect(bearerToken(header('Bearer kr_secret'))).toBe('kr_secret');
		// The scheme is case-insensitive per RFC 7235; the secret is not.
		expect(bearerToken(header('bearer kr_secret'))).toBe('kr_secret');
		expect(bearerToken(header('Basic kr_secret'))).toBeNull();
		expect(bearerToken(header('Bearer'))).toBeNull();
		expect(bearerToken(header('Bearer '))).toBeNull();
		expect(bearerToken(new Request('http://localhost/api'))).toBeNull();
	});
});

describe('sessionCookieOptions', () => {
	test('marks the cookie Secure over https and not over http', () => {
		expect(sessionCookieOptions(new URL('https://kilorep.example.com/api')).secure).toBe(true);
		// The LAN self-hoster. A Secure cookie sent over http is dropped by the
		// browser without a word, and the app silently behaves as signed out.
		expect(sessionCookieOptions(new URL('http://192.168.1.50:3000/api')).secure).toBe(false);
	});

	test('bounds a web credential to exactly the lifetime of its own cookie', () => {
		const now = new Date('2026-01-01T00:00:00Z');
		const { maxAge } = sessionCookieOptions(new URL('https://kilorep.example.com/api'));

		// Past this the browser has dropped the cookie anyway, so a row that
		// outlived it is only a working secret for whoever captured it.
		expect(webCredentialExpiry(now).getTime() - now.getTime()).toBe(maxAge * 1000);
	});

	test('is HttpOnly, Lax and site-wide, with a lifetime the browser will keep', () => {
		const options = sessionCookieOptions(new URL('https://kilorep.example.com/api'));

		expect(options.httpOnly).toBe(true);
		expect(options.sameSite).toBe('lax');
		expect(options.path).toBe('/');
		// Not an expiry — credentials never expire server-side. Without it the
		// cookie dies when the browser closes.
		expect(options.maxAge).toBeGreaterThan(300 * 24 * 60 * 60);
	});

	test('names one cookie, so a stale name cannot silently sign everyone out', () => {
		expect(SESSION_COOKIE).toBe('kr_session');
	});
});

describe('resolveCredential', () => {
	test('resolves a minted secret to its account', async () => {
		const user = await createUser(db, 'lifter@example.com', PASSWORD);
		const { token, record } = issueToken(db, user.id, 'Pixel 8', 'device');

		const credential = resolveCredential(db, token);

		expect(credential!.user.id).toBe(user.id);
		expect(credential!.token.id).toBe(record.id);
	});

	test('refuses nothing, an empty string and a secret that was never issued', () => {
		expect(resolveCredential(db, null)).toBeNull();
		expect(resolveCredential(db, '')).toBeNull();
		expect(resolveCredential(db, 'kr_not-a-real-token')).toBeNull();
	});

	test('refuses a revoked credential, which is the only way access ever ends', async () => {
		const user = await createUser(db, 'lifter@example.com', PASSWORD);
		const { token, record } = issueToken(db, user.id, 'Pixel 8', 'device');

		expect(revokeToken(db, user.id, record.id)).toBe(true);
		expect(resolveCredential(db, token)).toBeNull();
	});

	test('refuses an expired credential, though nothing sets an expiry today', async () => {
		const user = await createUser(db, 'lifter@example.com', PASSWORD);
		const past = new Date(Date.now() - 1000);
		const { token } = issueToken(db, user.id, 'old', 'api', past);

		expect(resolveCredential(db, token)).toBeNull();
	});

	test('records first use, then leaves the timestamp alone for an hour', async () => {
		const user = await createUser(db, 'lifter@example.com', PASSWORD);
		const { token, record } = issueToken(db, user.id, 'Pixel 8', 'device');
		expect(record.lastUsedAt).toBeNull();

		const lastUsed = (): Date | null => {
			const row = db.select().from(authTokens).where(eq(authTokens.id, record.id)).get();
			return row === undefined ? null : row.lastUsedAt;
		};

		resolveCredential(db, token);
		expect(lastUsed()).toBeInstanceOf(Date);

		// SQLite has one writer; a write per authenticated request would put a
		// sync push behind timestamp bookkeeping.
		const recent = new Date(Date.now() - 10 * 60 * 1000);
		db.update(authTokens).set({ lastUsedAt: recent }).where(eq(authTokens.id, record.id)).run();
		resolveCredential(db, token);
		expect(lastUsed()!.getTime()).toBe(recent.getTime());

		const stale = new Date(Date.now() - 2 * 60 * 60 * 1000);
		db.update(authTokens).set({ lastUsedAt: stale }).where(eq(authTokens.id, record.id)).run();
		resolveCredential(db, token);
		expect(lastUsed()!.getTime()).toBeGreaterThan(stale.getTime());
	});
});

describe('token ownership', () => {
	test('one account cannot revoke another account credential', async () => {
		const mine = await createUser(db, 'mine@example.com', PASSWORD);
		const yours = await createUser(db, 'yours@example.com', PASSWORD);
		const { token, record } = issueToken(db, yours.id, 'your phone', 'device');

		// A token id is visible to its owner, so the id alone must not be enough.
		expect(revokeToken(db, mine.id, record.id)).toBe(false);
		expect(resolveCredential(db, token)).not.toBeNull();

		expect(revokeToken(db, yours.id, record.id)).toBe(true);
	});

	test('lists only the caller own credentials', async () => {
		const mine = await createUser(db, 'mine@example.com', PASSWORD);
		const yours = await createUser(db, 'yours@example.com', PASSWORD);
		issueToken(db, mine.id, 'my phone', 'device');
		issueToken(db, mine.id, 'my mcp', 'api');
		issueToken(db, yours.id, 'your phone', 'device');

		expect(listTokens(db, mine.id).map((token) => token.label)).toEqual(['my phone', 'my mcp']);
	});

	test('deleting an account takes its credentials with it', async () => {
		const user = await createUser(db, 'lifter@example.com', PASSWORD);
		const { token } = issueToken(db, user.id, 'Pixel 8', 'device');

		expect(deleteUser(db, 'LIFTER@example.com')).toBe(true);
		expect(resolveCredential(db, token)).toBeNull();
		expect(deleteUser(db, 'lifter@example.com')).toBe(false);
	});
});

describe('login throttle', () => {
	const ADDRESS = '203.0.113.7';
	const ACCOUNT = 'lifter@example.com';

	test('blocks after ten failures and forgives on success', () => {
		for (let attempt = 0; attempt < 9; attempt++) {
			recordLoginFailure(ADDRESS, ACCOUNT);
		}
		expect(loginBlocked(ADDRESS, ACCOUNT)).toBe(false);

		recordLoginFailure(ADDRESS, ACCOUNT);
		expect(loginBlocked(ADDRESS, ACCOUNT)).toBe(true);

		// One typo must not cost an honest user fifteen minutes.
		clearLoginFailures(ADDRESS, ACCOUNT);
		expect(loginBlocked(ADDRESS, ACCOUNT)).toBe(false);
	});

	test('counts per address, so one caller cannot lock out another', () => {
		for (let attempt = 0; attempt < 10; attempt++) {
			recordLoginFailure(ADDRESS, ACCOUNT);
		}

		expect(loginBlocked(ADDRESS, ACCOUNT)).toBe(true);
		expect(loginBlocked('198.51.100.4', ACCOUNT)).toBe(false);
	});

	test('counts per account, so guesses at one do not lock its owner out of another', () => {
		for (let attempt = 0; attempt < 10; attempt++) {
			recordLoginFailure(ADDRESS, ACCOUNT);
		}

		expect(loginBlocked(ADDRESS, ACCOUNT)).toBe(true);
		expect(loginBlocked(ADDRESS, 'someone-else@example.com')).toBe(false);
	});

	test('a success elsewhere does not clear the guesses made here', () => {
		// The whole attack: hold one account on the instance, spend nine guesses
		// against somebody else's, sign in as yourself to wipe the counter,
		// repeat. Clearing by address alone made the limit unreachable.
		for (let round = 0; round < 6; round++) {
			for (let attempt = 0; attempt < 9; attempt++) {
				recordLoginFailure(ADDRESS, ACCOUNT);
			}
			clearLoginFailures(ADDRESS, 'attacker@example.com');
		}

		// The pair counter was reset by nothing, and the address counter — which
		// no success clears — has long since run out at 54 guesses.
		expect(loginBlocked(ADDRESS, ACCOUNT)).toBe(true);
		expect(loginBlocked(ADDRESS, 'yet-another@example.com')).toBe(true);
	});

	test('lets one address spend more than one account worth before it runs out', () => {
		// An address is legitimately several people — a household, an office, a
		// phone behind carrier NAT — so the address budget sits well above the
		// per-account one rather than on top of it.
		for (let attempt = 0; attempt < 10; attempt++) {
			recordLoginFailure(ADDRESS, 'first@example.com');
		}

		expect(loginBlocked(ADDRESS, 'first@example.com')).toBe(true);
		expect(loginBlocked(ADDRESS, 'second@example.com')).toBe(false);
	});

	test('caps how many accounts one address may create', () => {
		expect(registrationBlocked(ADDRESS)).toBe(false);

		for (let account = 0; account < 3; account++) {
			recordRegistration(ADDRESS);
		}

		// Registration had only the concurrency guard, which bounds how fast
		// accounts appear and not how many.
		expect(registrationBlocked(ADDRESS)).toBe(true);
		expect(registrationBlocked('198.51.100.4')).toBe(false);
	});

	test('keeps the failure map bounded against an address a caller can vary at will', () => {
		// A /64 is 2**64 addresses. Every entry here is fresh, so nothing expires
		// and nothing gets reclaimed — the cap is the only thing standing between
		// a stranger and unbounded memory.
		for (let host = 0; host < 12_000; host++) {
			recordLoginFailure(`2001:db8::${host.toString(16)}`, ACCOUNT);
		}

		// The oldest are gone and the newest are still counted, which is the
		// order a fixed window puts them in.
		expect(loginBlocked('2001:db8::0', ACCOUNT)).toBe(false);
		for (let attempt = 0; attempt < 9; attempt++) {
			recordLoginFailure('2001:db8::2ecf', ACCOUNT);
		}
		expect(loginBlocked('2001:db8::2ecf', ACCOUNT)).toBe(true);
	});

	test('runs at most two password verifications at once', async () => {
		// The guard that keeps the server answering at all: each verification
		// costs ~370 ms and ~128 MB on a four-thread pool shared with the SPA.
		const first = await acquireVerificationSlot();
		const second = await acquireVerificationSlot();

		let third: (() => void) | undefined;
		const pending = (async (): Promise<void> => {
			third = await acquireVerificationSlot();
		})();

		await delay(0);
		expect(third).toBeUndefined();

		first();
		await pending;
		expect(third).toBeDefined();

		third!();
		second();
	});

	test('reports saturation once the queue is full, and clears as it drains', async () => {
		const held = [await acquireVerificationSlot(), await acquireVerificationSlot()];
		expect(saturated()).toBe(false);

		const queued: Promise<() => void>[] = [];
		for (let caller = 0; caller < 64; caller++) {
			queued.push(acquireVerificationSlot());
		}

		await delay(0);
		expect(saturated()).toBe(true);

		for (const release of held) {
			release();
		}
		for (const waiting of queued) {
			const release = await waiting;
			release();
		}

		expect(saturated()).toBe(false);
	});
});
