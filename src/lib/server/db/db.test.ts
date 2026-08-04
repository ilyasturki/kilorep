import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
	runMigrations(db);
});

afterEach(() => {
	// Closed before the directory goes: unlinking the file out from under an open
	// `DatabaseSync` is silent on Linux, an error on Windows, and a leaked
	// descriptor per test either way.
	db.$client.close();
	rmSync(directory, { recursive: true, force: true });
});

describe('migrations', () => {
	test('are idempotent, as a restarting container replays them', () => {
		const applied = appliedMigrationCount(db);

		expect(applied).toBeGreaterThan(0);

		runMigrations(db);
		expect(appliedMigrationCount(db)).toBe(applied);
	});

	test('count zero on a database that has never been migrated', () => {
		// Not a throw: `/api/health` reports this database as reachable and
		// unmigrated, which is exactly what it is.
		const fresh = createDatabase(path.join(directory, 'fresh.db'));
		expect(appliedMigrationCount(fresh)).toBe(0);
		fresh.$client.close();
	});

	test('rebuild a table without taking its dependents with it', async () => {
		// SQLite cannot alter a column, so drizzle-kit answers every change to one
		// with this: new table, copy, `DROP TABLE`, rename. `users` is the parent of
		// two `on delete cascade` children, so with foreign keys enforced the
		// implicit delete inside that DROP silently empties both — every credential
		// revoked, and every sync counter reset to a number its devices are already
		// past. The pragma drizzle writes into the migration cannot prevent it: the
		// migrator runs each file in a transaction, where the pragma is a no-op.
		// `runMigrations` issues it outside one instead, and this is what says so.
		const folder = path.join(directory, 'migrations');
		cpSync(migrationsFolder, folder, { recursive: true });

		const user = await createUser(db, 'lifter@example.com', 'correct horse');
		const { record } = issueToken(db, user.id, 'Pixel 8', 'device');
		claimSeq(db, user.id);
		claimSeq(db, user.id);
		const before = db.select().from(syncCounters).where(eq(syncCounters.userId, user.id)).get()!
			.nextSeq;
		expect(before).toBeGreaterThan(1);

		// Named to sort last, and written exactly as drizzle-kit writes one —
		// pointless pragmas included, because those are part of what is being
		// tested.
		const rebuild = path.join(folder, '99999999999999_rebuild_users');
		mkdirSync(rebuild, { recursive: true });
		writeFileSync(
			path.join(rebuild, 'migration.sql'),
			[
				'PRAGMA foreign_keys=OFF;',
				'CREATE TABLE `__new_users` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`email` text NOT NULL UNIQUE,\n\t`password_hash` text,\n\t`google_sub` text UNIQUE,\n\t`created_at` integer NOT NULL\n);',
				'INSERT INTO `__new_users`(`id`, `email`, `password_hash`, `google_sub`, `created_at`) SELECT `id`, `email`, `password_hash`, `google_sub`, `created_at` FROM `users`;',
				'DROP TABLE `users`;',
				'ALTER TABLE `__new_users` RENAME TO `users`;',
				'PRAGMA foreign_keys=ON;'
			].join('--> statement-breakpoint\n')
		);
		writeFileSync(path.join(rebuild, 'snapshot.json'), '{}');

		runMigrations(db, folder);

		expect(db.select().from(users).where(eq(users.id, user.id)).get()).toBeDefined();
		expect(db.select().from(authTokens).where(eq(authTokens.id, record.id)).get()).toBeDefined();
		expect(
			db.select().from(syncCounters).where(eq(syncCounters.userId, user.id)).get()!.nextSeq
		).toBe(before);
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

		// The column is nullable for accounts that only ever signed in with Google;
		// this path is the one that always writes it.
		const hash = user.passwordHash!;
		expect(hash).not.toContain('correct horse');
		await expect(verifyPassword('correct horse', hash)).resolves.toBe(true);
		await expect(verifyPassword('wrong horse', hash)).resolves.toBe(false);
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
