import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setApiBase } from '$lib/api/client';
import { createUser } from '$lib/server/auth/accounts';
import type { Database } from '$lib/server/db/client';
import { createDatabase } from '$lib/server/db/client';
import { runMigrations } from '$lib/server/db/migrate';
import { syncExchange } from '$lib/server/db/sync';
import { openDatabase } from '$lib/store/db';
import { Store } from '$lib/store/store';
import type { Workout } from '$lib/domain/workout';
import type { SyncRequest } from './protocol.ts';

import { syncNow } from './client.ts';

let server: Database;
let userId: string;
let store: Store;

function isRequestShape(value: unknown): value is SyncRequest {
	return typeof value === 'object' && value !== null && 'watermark' in value && 'push' in value;
}

beforeEach(async () => {
	server = createDatabase(':memory:');
	runMigrations(server);
	const user = await createUser(server, 'lifter@example.com', 'a-long-enough-password');
	userId = user.id;

	setApiBase('http://sync.test');

	vi.stubGlobal(
		'fetch',
		vi.fn((input: unknown, init: RequestInit = {}) => {
			expect(input).toBe('http://sync.test/api/sync');

			const { body } = init;

			if (typeof body !== 'string') {
				throw new TypeError('expected a JSON string body');
			}

			const parsed: unknown = JSON.parse(body);

			if (!isRequestShape(parsed)) {
				throw new Error('malformed sync request');
			}

			return Response.json(syncExchange(server, userId, parsed));
		})
	);

	store = new Store(await openDatabase(`kilorep-e2e-${Math.random()}`));
});

afterEach(() => {
	vi.unstubAllGlobals();
	setApiBase(null);
});

let n = 0;

function lift(): Workout {
	n += 1;

	return {
		id: `e2e-${n}`,
		templateId: null,
		startedAt: n * 1000,
		entries: [
			{
				id: `e2e-${n}-entry`,
				exercises: [
					{
						id: `e2e-${n}-node`,
						exerciseId: 'bench-press',
						sets: [
							{
								id: `e2e-${n}-set`,
								type: 'normal',
								plannedReps: null,
								weight: 80,
								reps: 8,
								rpe: null,
								completed: true
							}
						]
					}
				]
			}
		]
	};
}

describe('syncNow', () => {
	it('pushes a finished workout up and settles it clean', async () => {
		const workout = lift();
		await store.finishWorkout(workout, 12_345);

		await syncNow(userId, store);

		expect(await store.dirtyRecords()).toEqual([]);
		expect(await store.watermark()).toBeGreaterThan(0);

		const onServer = syncExchange(server, userId, { watermark: 0, push: [] });
		expect(onServer.records.some((r) => r.id === workout.id)).toBe(true);
	});

	it('pulls another device’s workout down into the store', async () => {
		const theirs = lift();

		syncExchange(server, userId, {
			watermark: 0,
			push: [
				{
					id: theirs.id,
					kind: 'workout',
					updatedAt: 999,
					deletedAt: null,
					payload: Object.assign(theirs, { finishedAt: 999 })
				}
			]
		});

		await syncNow(userId, store);

		const listed = await store.listWorkouts();
		expect(listed.some((w) => w.id === theirs.id)).toBe(true);
	});

	it('leaves records dirty and says nothing when the network is down', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				await Promise.reject(new TypeError('fetch failed'));
			})
		);

		const workout = lift();
		await store.finishWorkout(workout, 23_456);

		await expect(syncNow(userId, store)).resolves.toBeUndefined();

		const dirty = await store.dirtyRecords();
		expect(dirty.some((r) => r.id === workout.id)).toBe(true);
	});

	it('refuses to sync a store owned by someone else', async () => {
		await store.claimOwner(userId);

		const workout = lift();
		await store.finishWorkout(workout, 34_567);

		await syncNow('someone-else', store);

		const dirty = await store.dirtyRecords();
		expect(dirty.some((r) => r.id === workout.id)).toBe(true);
	});
});
