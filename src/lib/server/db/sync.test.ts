import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import type { WireRecord } from '$lib/sync/protocol';

import { createUser, insertUser } from '../auth/accounts.ts';
import { writeRecord } from '../mcp/write.ts';
import type { Database } from './client.ts';
import { createDatabase } from './client.ts';
import { runMigrations } from './migrate.ts';
import { syncCounters } from './schema.ts';
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

// Stands in for `account:create` run against a live server: its commit lands after the exchange has read and before it writes.
function interleaved(server: Database, between: () => void): Database {
	const transaction: Database['transaction'] = (run, config) =>
		server.transaction((tx) => {
			tx.select().from(syncCounters).all();
			between();

			return run(tx);
		}, config);

	return Object.assign(Object.create(server) as Database, { transaction });
}

describe('beside another connection', () => {
	let directory: string;
	let server: Database;
	let script: Database;
	let id: string;

	beforeEach(async () => {
		directory = mkdtempSync(path.join(os.tmpdir(), 'kilorep-test-'));
		const file = path.join(directory, 'test.db');
		server = createDatabase(file);
		runMigrations(server);
		script = createDatabase(file);
		script.$client.exec('pragma busy_timeout = 0');
		({ id } = await createUser(server, 'lifter@example.com', 'a-long-enough-password'));
	});

	afterEach(() => {
		script.$client.close();
		server.$client.close();
		rmSync(directory, { recursive: true, force: true });
	});

	// Held off by the exchange's lock it fails at once (busy_timeout 0); a real script would wait, so it writes again after.
	function scripted(): { beside: Database; settle: () => void } {
		let written = false;
		const beside = interleaved(server, () => {
			try {
				insertUser(script, 'other@example.com', null, null);
				written = true;
			} catch {
				/* empty */
			}
		});

		return {
			beside,
			settle: () => {
				if (!written) {
					insertUser(script, 'other@example.com', null, null);
				}
			}
		};
	}

	test('a push lands while an account is written elsewhere', () => {
		const { beside, settle } = scripted();

		const response = syncExchange(beside, id, { watermark: 0, push: [record('w1', 100)] });

		expect(response.acks).toEqual([{ id: 'w1', updatedAt: 100 }]);
		settle();
	});

	test('an assistant’s write lands while an account is written elsewhere', () => {
		const { beside, settle } = scripted();

		const outcome = writeRecord(beside, id, {
			id: 'w1',
			kind: 'workout',
			payload: { id: 'w1' },
			expect: 'absent'
		});

		expect(outcome.ok).toBe(true);
		settle();
	});
});
