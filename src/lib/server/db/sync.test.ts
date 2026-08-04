import { beforeEach, describe, expect, test } from 'vitest';

import type { WireRecord } from '$lib/sync/protocol';

import { createUser } from '../auth/accounts.ts';
import type { Database } from './client.ts';
import { createDatabase } from './client.ts';
import { runMigrations } from './migrate.ts';
import { syncExchange } from './sync.ts';

let db: Database;
let userId: string;

beforeEach(async () => {
	db = createDatabase(':memory:');
	runMigrations(db);
	const user = await createUser(db, 'lifter@example.com', 'a-long-enough-password');
	userId = user.id;
});

const record = (id: string, updatedAt: number, payload?: unknown): WireRecord => ({
	id,
	kind: 'workout',
	updatedAt,
	deletedAt: null,
	payload: payload ?? { id }
});

describe('push', () => {
	test('accepts a new record and acks the pushed updatedAt', () => {
		const response = syncExchange(db, userId, { watermark: 0, push: [record('w1', 100)] });

		expect(response.acks).toEqual([{ id: 'w1', updatedAt: 100 }]);
		expect(response.records).toEqual([]);
		expect(response.watermark).toBe(1);
	});

	test('newer push overwrites, older push loses and gets the winner back', () => {
		syncExchange(db, userId, { watermark: 0, push: [record('w1', 200, { v: 'newer' })] });

		const losing = syncExchange(db, userId, {
			watermark: 1,
			push: [record('w1', 150, { v: 'older' })]
		});

		expect(losing.acks).toEqual([]);
		expect(losing.records).toHaveLength(1);
		expect(losing.records[0].updatedAt).toBe(200);
		expect(losing.records[0].payload).toEqual({ v: 'newer' });
	});

	test('a replayed push is superseded, not rewritten — and claims no second seq', () => {
		syncExchange(db, userId, { watermark: 0, push: [record('w1', 100)] });
		const replay = syncExchange(db, userId, { watermark: 0, push: [record('w1', 100)] });

		expect(replay.acks).toEqual([]);
		expect(replay.records).toHaveLength(1);
		expect(replay.records[0].updatedAt).toBe(100);
		expect(replay.watermark).toBe(1);
	});

	test('a tombstone syncs like any record', () => {
		syncExchange(db, userId, { watermark: 0, push: [record('w1', 100)] });

		const tombstone = record('w1', 300);
		tombstone.deletedAt = 300;
		syncExchange(db, userId, { watermark: 1, push: [tombstone] });

		const pull = syncExchange(db, userId, { watermark: 0, push: [] });

		expect(pull.records).toHaveLength(1);
		expect(pull.records[0].deletedAt).toBe(300);
	});
});

describe('pull', () => {
	test('watermark zero is the full pull, in seq order', () => {
		syncExchange(db, userId, { watermark: 0, push: [record('w1', 100)] });
		syncExchange(db, userId, { watermark: 1, push: [record('w2', 200)] });

		const fresh = syncExchange(db, userId, { watermark: 0, push: [] });

		expect(fresh.records.map((r) => r.id)).toEqual(['w1', 'w2']);
		expect(fresh.watermark).toBe(2);
	});

	test('a caught-up client pulls nothing and keeps its watermark', () => {
		syncExchange(db, userId, { watermark: 0, push: [record('w1', 100)] });

		const idle = syncExchange(db, userId, { watermark: 1, push: [] });

		expect(idle.records).toEqual([]);
		expect(idle.watermark).toBe(1);
	});

	test('an overwritten record appears once, as its current version', () => {
		syncExchange(db, userId, { watermark: 0, push: [record('w1', 100, { v: 'first' })] });
		syncExchange(db, userId, { watermark: 1, push: [record('w1', 200, { v: 'second' })] });

		const fresh = syncExchange(db, userId, { watermark: 0, push: [] });

		expect(fresh.records).toHaveLength(1);
		expect(fresh.records[0].payload).toEqual({ v: 'second' });
		expect(fresh.watermark).toBe(2);
	});
});

describe('tenancy', () => {
	test('one user never sees another', async () => {
		const other = await createUser(db, 'other@example.com', 'a-long-enough-password');

		syncExchange(db, userId, { watermark: 0, push: [record('w1', 100)] });
		const theirs = syncExchange(db, other.id, { watermark: 0, push: [] });

		expect(theirs.records).toEqual([]);
		expect(theirs.watermark).toBe(0);
	});

	test('the same record id can exist under both users', async () => {
		const other = await createUser(db, 'other@example.com', 'a-long-enough-password');

		syncExchange(db, userId, { watermark: 0, push: [record('shared-id', 100, { of: 'mine' })] });
		const response = syncExchange(db, other.id, {
			watermark: 0,
			push: [record('shared-id', 50, { of: 'theirs' })]
		});

		expect(response.acks).toHaveLength(1);

		const mine = syncExchange(db, userId, { watermark: 0, push: [] });
		expect(mine.records[0].payload).toEqual({ of: 'mine' });
	});
});
