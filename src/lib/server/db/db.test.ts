import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { eq } from 'drizzle-orm';

import { createUser, issueToken } from '../auth/accounts.ts';
import { hashPassword, verifyPassword } from '../auth/password.ts';
import { hashToken, mintToken } from '../auth/tokens.ts';
import type { Database } from './client.ts';
import { createDatabase } from './client.ts';
import { migrationsFolder } from './config.ts';
import { appliedMigrationCount, runMigrations } from './migrate.ts';
import { authTokens, syncCounters, users } from './schema.ts';
import { claimSeq } from './seq.ts';

/**
 * Runs against a real SQLite file rather than `:memory:` on purpose: the file
 * path, the directory creation and the WAL pragmas are part of what is being
 * verified, and none of them exist in memory.
 */

let directory: string;
let db: Database;

beforeEach(() => {
	directory = mkdtempSync(path.join(os.tmpdir(), 'kilorep-test-'));
	db = createDatabase(path.join(directory, 'test.db'));
	runMigrations(db, migrationsFolder);
});

afterEach(() => {
	// Closed before the directory goes: unlinking the file out from under an open
	// `DatabaseSync` is silent on Linux, an error on Windows, and a leaked
	// descriptor per test either way.
	db.$client.close();
	rmSync(directory, { recursive: true, force: true });
});

describe('migrations', () => {
	test('apply from the committed folder', () => {
		expect(appliedMigrationCount(db)).toBeGreaterThan(0);
	});

	test('are idempotent, as a restarting container replays them', () => {
		const applied = appliedMigrationCount(db);
		runMigrations(db, migrationsFolder);
		expect(appliedMigrationCount(db)).toBe(applied);
	});

	test('count zero on a database that has never been migrated', () => {
		// Not a throw: `/api/health` reports this database as reachable and
		// unmigrated, which is exactly what it is.
		const fresh = createDatabase(path.join(directory, 'fresh.db'));
		expect(appliedMigrationCount(fresh)).toBe(0);
		fresh.$client.close();
	});
});

describe('accounts', () => {
	test('create a user and its sync counter together', async () => {
		const user = await createUser(db, 'Lifter@Example.com ', 'correct horse');

		expect(user.id).toMatch(/^[0-9a-f-]{36}$/u);
		// Normalised, so a capitalised retype cannot become a second account.
		expect(user.email).toBe('lifter@example.com');
		expect(user.createdAt).toBeInstanceOf(Date);

		const counter = db.select().from(syncCounters).where(eq(syncCounters.userId, user.id)).get();
		expect(counter!.nextSeq).toBe(1);
	});

	test('never store the password', async () => {
		const user = await createUser(db, 'a@b.c', 'correct horse');

		expect(user.passwordHash).not.toContain('correct horse');
		await expect(verifyPassword('correct horse', user.passwordHash)).resolves.toBe(true);
		await expect(verifyPassword('wrong horse', user.passwordHash)).resolves.toBe(false);
	});

	test('reject a duplicate email', async () => {
		await createUser(db, 'a@b.c', 'first password');
		await expect(createUser(db, 'a@b.c', 'second password')).rejects.toThrow();
	});
});

describe('tokens', () => {
	test('are stored only as a hash, and look up by it', async () => {
		const user = await createUser(db, 'a@b.c', 'test password');
		const { token, record } = issueToken(db, user.id, 'Pixel 8', 'device');

		expect(token.startsWith('kr_')).toBe(true);
		expect(record.tokenHash).toBe(hashToken(token));
		expect(record.tokenPrefix).toBe(token.slice(0, 11));
		expect(record.expiresAt).toBeNull();

		const rows = db.select().from(authTokens).all();
		expect(JSON.stringify(rows)).not.toContain(token.slice(3));

		const found = db
			.select()
			.from(authTokens)
			.where(eq(authTokens.tokenHash, hashToken(token)))
			.get();
		expect(found!.id).toBe(record.id);
	});

	test('are unique per mint', () => {
		const minted = new Set(Array.from({ length: 50 }, () => mintToken().token));
		expect(minted.size).toBe(50);
	});
});

describe('seq', () => {
	test('is monotonic and starts at 1', async () => {
		const user = await createUser(db, 'a@b.c', 'test password');

		expect(claimSeq(db, user.id)).toBe(1);
		expect(claimSeq(db, user.id)).toBe(2);
		expect(claimSeq(db, user.id)).toBe(3);
	});

	test('is per user, so one account never advances another', async () => {
		const first = await createUser(db, 'a@b.c', 'test password');
		const second = await createUser(db, 'd@e.f', 'test password');

		claimSeq(db, first.id);
		claimSeq(db, first.id);

		expect(claimSeq(db, second.id)).toBe(1);
	});

	test('claims inside a transaction and rolls back with it', async () => {
		const user = await createUser(db, 'a@b.c', 'test password');

		expect(() =>
			db.transaction((tx) => {
				claimSeq(tx, user.id);
				throw new Error('write failed after claiming');
			})
		).toThrow('write failed after claiming');

		// The consumed number must come back, or the client's watermark steps
		// over a row that was never written.
		expect(claimSeq(db, user.id)).toBe(1);
	});

	test('throws rather than inventing a number for an unknown user', () => {
		expect(() => claimSeq(db, 'nobody')).toThrow(/No sync counter/u);
	});
});

describe('constraints', () => {
	test('cascade to tokens and counters, proving foreign keys are enforced', async () => {
		const user = await createUser(db, 'a@b.c', 'test password');
		issueToken(db, user.id, 'Pixel 8', 'device');

		db.delete(users).where(eq(users.id, user.id)).run();

		expect(db.select().from(authTokens).all()).toHaveLength(0);
		expect(db.select().from(syncCounters).all()).toHaveLength(0);
	});

	test('refuse a token for a user that does not exist', () => {
		expect(() => issueToken(db, 'nobody', 'ghost', 'api')).toThrow();
	});

	test('refuse a null id, which a text primary key allows unless told not to', () => {
		// SQLite enforces NOT NULL implicitly for `integer primary key` and for
		// nothing else. Without the explicit constraint this inserts — twice —
		// and the ghost rows are unreachable by id forever.
		//
		// Straight at the driver rather than through drizzle, whose wrapper
		// replaces the message with the query text and leaves SQLite's own on
		// `cause`. It is SQLite's constraint that is under test.
		expect(() => {
			db.$client.exec(
				`insert into users (id, email, password_hash, created_at) values (null, 'a@b.c', 'x', 1)`
			);
		}).toThrow(/NOT NULL constraint failed: users\.id/u);
	});
});

describe('password hashing', () => {
	test('salts, so two identical passwords differ', async () => {
		expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
	});

	test('rejects a malformed stored hash instead of throwing', async () => {
		await expect(verifyPassword('pw', 'garbage')).resolves.toBe(false);
		await expect(verifyPassword('pw', 'bcrypt$1$2$3$4$5')).resolves.toBe(false);
		// Six parts and the right scheme, but parameters scrypt itself rejects
		// with a throw: `N` must be a power of two, and a login route owes the
		// client a 401 rather than a 500.
		await expect(verifyPassword('pw', 'scrypt$3$8$1$AAAAAAAAAAAAAAAA$AAAA')).resolves.toBe(false);
		// An `N` no honest hash would carry: gigabytes of allocation on demand.
		await expect(verifyPassword('pw', `scrypt$${2 ** 24}$8$1$AAAAAAAAAAAAAAAA$AAAA`)).resolves.toBe(
			false
		);
	});

	test('rejects a truncated key rather than accepting every password', async () => {
		// The bug this exists to prevent: an empty or undecodable key segment
		// decodes to zero bytes, and a zero-byte constant-time comparison is
		// true for any input at all.
		await expect(verifyPassword('anything', 'scrypt$131072$8$1$AAAAAAAAAAAAAAAA$')).resolves.toBe(
			false
		);
		await expect(
			verifyPassword('anything', 'scrypt$131072$8$1$AAAAAAAAAAAAAAAA$%%%%')
		).resolves.toBe(false);
		// Short but non-empty is no better — a 16-byte key is not this scheme's.
		await expect(
			verifyPassword('anything', 'scrypt$131072$8$1$AAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAA==')
		).resolves.toBe(false);
	});

	test('rejects a hash whose salt was truncated away', async () => {
		const stored = await hashPassword('correct horse');
		const [, N, r, p, , key] = stored.split('$');

		await expect(
			verifyPassword('correct horse', ['scrypt', N, r, p, '', key].join('$'))
		).resolves.toBe(false);
	});
});
