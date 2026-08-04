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

let directory: string;
let db: Database;

beforeEach(() => {
	directory = mkdtempSync(path.join(os.tmpdir(), 'kilorep-test-'));
	db = createDatabase(path.join(directory, 'test.db'));
	runMigrations(db);
});

afterEach(() => {
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
		const fresh = createDatabase(path.join(directory, 'fresh.db'));
		expect(appliedMigrationCount(fresh)).toBe(0);
		fresh.$client.close();
	});

	test('rebuild a table without taking its dependents with it', async () => {
		const folder = path.join(directory, 'migrations');
		cpSync(migrationsFolder, folder, { recursive: true });

		const user = await createUser(db, 'lifter@example.com', 'correct horse');
		const { record } = issueToken(db, user.id, 'Pixel 8', 'device');
		claimSeq(db, user.id);
		const before = db.select().from(syncCounters).where(eq(syncCounters.userId, user.id)).get()!
			.nextSeq;
		expect(before).toBeGreaterThan(1);

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
		expect(user.email).toBe('lifter@example.com');
		expect(user.createdAt).toBeInstanceOf(Date);

		const counter = db.select().from(syncCounters).where(eq(syncCounters.userId, user.id)).get();
		expect(counter!.nextSeq).toBe(1);
	});

	test('never store the password', async () => {
		const user = await createUser(db, 'a@b.c', 'correct horse');

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
	test('are stored only as a hash', async () => {
		const user = await createUser(db, 'a@b.c', 'test password');
		const { token, record } = issueToken(db, user.id, 'Pixel 8', 'device');

		expect(token.startsWith('kr_')).toBe(true);
		expect(record.tokenHash).toBe(hashToken(token));
		expect(record.tokenPrefix).toBe(token.slice(0, 11));
		expect(record.expiresAt).toBeNull();

		const rows = db.select().from(authTokens).all();
		expect(JSON.stringify(rows)).not.toContain(token.slice(3));
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
		await expect(verifyPassword('pw', 'scrypt$3$8$1$AAAAAAAAAAAAAAAA$AAAA')).resolves.toBe(false);
		await expect(verifyPassword('pw', `scrypt$${2 ** 24}$8$1$AAAAAAAAAAAAAAAA$AAAA`)).resolves.toBe(
			false
		);
	});

	test('rejects a truncated key rather than accepting every password', async () => {
		await expect(verifyPassword('anything', 'scrypt$131072$8$1$AAAAAAAAAAAAAAAA$')).resolves.toBe(
			false
		);
		await expect(
			verifyPassword('anything', 'scrypt$131072$8$1$AAAAAAAAAAAAAAAA$%%%%')
		).resolves.toBe(false);
		await expect(
			verifyPassword('anything', 'scrypt$131072$8$1$AAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAA==')
		).resolves.toBe(false);
	});

	test('rejects a hash whose salt was truncated away', async () => {
		await expect(
			verifyPassword('correct horse', `scrypt$131072$8$1$$${'A'.repeat(44)}`)
		).resolves.toBe(false);
	});
});
