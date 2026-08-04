import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { eq } from 'drizzle-orm';

import type { Database } from '../db/client.ts';
import { createDatabase } from '../db/client.ts';
import { runMigrations } from '../db/migrate.ts';
import { authTokens } from '../db/schema.ts';
import {
	createUser,
	credentialProblem,
	deleteUser,
	emailProblem,
	findUserByGoogleSub,
	issueToken,
	listTokens,
	resolveGoogleIdentity,
	revokeToken,
	verifyLogin
} from './accounts.ts';
import { verifyClaims } from './google.ts';
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
	runMigrations(db);
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

const OPEN = true;
const CLOSED = false;

function identity(subject: string, email: string): { subject: string; email: string } {
	return { subject, email };
}

/**
 * The rule about who gets an account, exhaustively — the part of Google sign-in
 * worth testing, and the reason it is a function that takes claims rather than
 * something buried in the callback beside two `fetch` calls.
 */
describe('resolveGoogleIdentity', () => {
	test('creates an account for an unknown identity when the instance is open', () => {
		const result = resolveGoogleIdentity(db, identity('sub-1', 'Lifter@Example.com'), OPEN);

		expect(result).toMatchObject({ ok: true, outcome: 'created' });
		expect(result.ok && result.user.email).toBe('lifter@example.com');
		expect(result.ok && result.user.googleSub).toBe('sub-1');
		expect(result.ok && result.user.passwordHash).toBeNull();
	});

	test('refuses an unknown identity when the instance is closed', () => {
		expect(resolveGoogleIdentity(db, identity('sub-1', 'stranger@example.com'), CLOSED)).toEqual({
			ok: false,
			reason: 'closed'
		});

		expect(findUserByGoogleSub(db, 'sub-1')).toBeUndefined();
	});

	test('signs in a subject it has seen before', () => {
		const created = resolveGoogleIdentity(db, identity('sub-1', 'lifter@example.com'), OPEN);
		const again = resolveGoogleIdentity(db, identity('sub-1', 'lifter@example.com'), CLOSED);

		// Closed the second time, and it still works: the gate is about creating.
		expect(again).toMatchObject({ ok: true, outcome: 'signed-in' });
		expect(again.ok && created.ok && again.user.id).toBe(created.ok && created.user.id);
	});

	test('links a new subject to the account that already holds its verified address', async () => {
		const existing = await createUser(db, 'operator@example.com', PASSWORD);

		// Closed, deliberately: linking is not creation, and this is how an
		// operator moves onto Google without opening the instance to strangers.
		const result = resolveGoogleIdentity(db, identity('sub-9', 'OPERATOR@example.com'), CLOSED);

		expect(result).toMatchObject({ ok: true, outcome: 'linked' });
		expect(result.ok && result.user.id).toBe(existing.id);
		expect(result.ok && result.user.passwordHash).not.toBeNull();
		await expect(verifyLogin(db, 'operator@example.com', PASSWORD)).resolves.not.toBeNull();
	});

	test('refuses a second subject claiming an address that is already linked', () => {
		resolveGoogleIdentity(db, identity('sub-1', 'lifter@example.com'), OPEN);

		expect(resolveGoogleIdentity(db, identity('sub-2', 'lifter@example.com'), OPEN)).toEqual({
			ok: false,
			reason: 'claimed'
		});
		expect(findUserByGoogleSub(db, 'sub-1')).toBeDefined();
		expect(findUserByGoogleSub(db, 'sub-2')).toBeUndefined();
	});

	test('follows the address when a known subject changes it', () => {
		const created = resolveGoogleIdentity(db, identity('sub-1', 'old@example.com'), OPEN);
		const moved = resolveGoogleIdentity(db, identity('sub-1', 'new@example.com'), CLOSED);

		expect(moved.ok && moved.user.id).toBe(created.ok && created.user.id);
		expect(moved.ok && moved.user.email).toBe('new@example.com');
	});

	test('keeps the old address when the new one belongs to someone else', async () => {
		await createUser(db, 'taken@example.com', PASSWORD);
		const created = resolveGoogleIdentity(db, identity('sub-1', 'mine@example.com'), OPEN);

		const moved = resolveGoogleIdentity(db, identity('sub-1', 'taken@example.com'), OPEN);

		expect(moved).toMatchObject({ ok: true, outcome: 'signed-in' });
		expect(moved.ok && moved.user.id).toBe(created.ok && created.user.id);
		expect(moved.ok && moved.user.email).toBe('mine@example.com');
	});
});

describe('a Google-only account has no password', () => {
	test('refuses every password, and takes as long doing it as a real account', async () => {
		const result = resolveGoogleIdentity(db, { subject: 'sub-1', email: 'g@example.com' }, true);
		expect(result.ok && result.user.passwordHash).toBeNull();

		// Not merely false: the empty string is what a caller sends when trying to
		// find out whether an account has a password at all.
		await expect(verifyLogin(db, 'g@example.com', PASSWORD)).resolves.toBeNull();
		await expect(verifyLogin(db, 'g@example.com', '')).resolves.toBeNull();
	});
});

/**
 * Claim validation, against tokens built here rather than fetched. The two
 * `fetch` calls around it are the untested part by decision — what matters is
 * that nothing gets past this with the wrong audience or an unverified address.
 */
const CLIENT = 'client-123.apps.googleusercontent.com';
const NOW = Date.parse('2026-07-29T12:00:00Z');

function segment(value: unknown): string {
	return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/**
 * A well-formed token, with whatever claims this case wants to break. The base
 * is rebuilt per call so no case can leak into another.
 *
 * Overrides are copied in a loop, which looks like the long way round and is the
 * only way left: spread is banned outside components, `Object.assign` on a fresh
 * literal trips `prefer-object-spread`, and assigning after the initializer
 * trips `no-immediate-mutation`.
 */
function idToken(overrides: Record<string, unknown> = {}): string {
	const claims: Record<string, unknown> = {
		iss: 'https://accounts.google.com',
		aud: CLIENT,
		sub: 'sub-1',
		exp: NOW / 1000 + 3600,
		email: 'lifter@example.com',
		email_verified: true
	};

	for (const [claim, value] of Object.entries(overrides)) {
		claims[claim] = value;
	}

	// The signature is never read — see `verifyClaims` on why TLS stands in for
	// it — so a token only has to be shaped like one.
	return `${segment({ alg: 'RS256' })}.${segment(claims)}.signature`;
}

describe('verifyClaims', () => {
	test('accepts a well-formed token and reads the subject and address out of it', () => {
		expect(verifyClaims(idToken(), CLIENT, NOW)).toEqual({
			ok: true,
			identity: { subject: 'sub-1', email: 'lifter@example.com' }
		});
	});

	test('refuses a token minted for another client', () => {
		expect(verifyClaims(idToken({ aud: 'someone-else' }), CLIENT, NOW)).toEqual({
			ok: false,
			problem: 'wrong-audience'
		});
	});

	test('refuses a token from another issuer, and accepts both spellings of this one', () => {
		expect(verifyClaims(idToken({ iss: 'https://evil.example' }), CLIENT, NOW)).toEqual({
			ok: false,
			problem: 'wrong-issuer'
		});
		expect(verifyClaims(idToken({ iss: 'accounts.google.com' }), CLIENT, NOW).ok).toBe(true);
	});

	test('refuses an expired token but forgives a minute of clock disagreement', () => {
		expect(verifyClaims(idToken({ exp: NOW / 1000 - 3600 }), CLIENT, NOW)).toEqual({
			ok: false,
			problem: 'expired'
		});
		expect(verifyClaims(idToken({ exp: NOW / 1000 - 30 }), CLIENT, NOW).ok).toBe(true);
	});

	test('refuses an unverified address, however it is spelled', () => {
		expect(verifyClaims(idToken({ email_verified: false }), CLIENT, NOW)).toEqual({
			ok: false,
			problem: 'unverified-email'
		});
		expect(verifyClaims(idToken({ email_verified: 'false' }), CLIENT, NOW).ok).toBe(false);
		expect(verifyClaims(idToken({ email_verified: undefined }), CLIENT, NOW).ok).toBe(false);
		expect(verifyClaims(idToken({ email_verified: 'true' }), CLIENT, NOW).ok).toBe(true);
	});

	test('refuses anything that is not a token', () => {
		expect(verifyClaims('not.a.token', CLIENT, NOW)).toEqual({ ok: false, problem: 'malformed' });
		expect(verifyClaims('', CLIENT, NOW)).toEqual({ ok: false, problem: 'malformed' });
		expect(verifyClaims(idToken({ sub: '' }), CLIENT, NOW)).toEqual({
			ok: false,
			problem: 'malformed'
		});
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
		expect(sessionCookieOptions(new URL('http://192.168.1.50:3000/api')).secure).toBe(false);
	});

	test('bounds a web credential to exactly the lifetime of its own cookie', () => {
		const now = new Date('2026-01-01T00:00:00Z');
		const { maxAge } = sessionCookieOptions(new URL('https://kilorep.example.com/api'));

		expect(webCredentialExpiry(now).getTime() - now.getTime()).toBe(maxAge * 1000);
	});

	test('is HttpOnly, Lax and site-wide, with a lifetime the browser will keep', () => {
		const options = sessionCookieOptions(new URL('https://kilorep.example.com/api'));

		expect(options.httpOnly).toBe(true);
		expect(options.sameSite).toBe('lax');
		expect(options.path).toBe('/');
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

	test('a success elsewhere does not clear the guesses made here', () => {
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
		for (let attempt = 0; attempt < 10; attempt++) {
			recordLoginFailure(ADDRESS, 'first@example.com');
		}

		expect(loginBlocked(ADDRESS, 'first@example.com')).toBe(true);
		expect(loginBlocked(ADDRESS, 'second@example.com')).toBe(false);
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
