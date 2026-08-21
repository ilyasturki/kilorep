import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setApiBase, setDeviceToken } from '$lib/api/client';
import { createUser } from '$lib/server/auth/accounts';
import type { Database } from '$lib/server/db/client';
import { createDatabase } from '$lib/server/db/client';
import { runMigrations } from '$lib/server/db/migrate';
import { syncExchange } from '$lib/server/db/sync';
import { openDatabase } from '$lib/store/db';
import { Store, getStore } from '$lib/store/store';
import type { Workout } from '$lib/domain/workout';
import type { SyncRequest } from './protocol.ts';

import { readSyncState, stopSyncing, syncNow, syncPromptly, syncSoon } from './client.ts';
import { healsItself, resetSyncStatus, syncStatus } from './status.ts';

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

	resetSyncStatus();
});

afterEach(() => {
	stopSyncing();
	vi.useRealTimers();
	vi.unstubAllGlobals();
	setApiBase(null);
	setDeviceToken(null);
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

// Only the two timers sync itself uses: fake-indexeddb runs on `setImmediate`, and
// faking that leaves every store read pending forever.
function freeze(): void {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
}

// `tickAsync` yields to the real event loop between ticks, which is what lets an
// exchange mid-flight through IndexedDB finish before the assertion reads it.
async function settled(check: () => boolean, tries = 50): Promise<void> {
	if (check() || tries === 0) {
		return;
	}

	await vi.advanceTimersByTimeAsync(0);

	await settled(check, tries - 1);
}

function failing(): ReturnType<typeof vi.fn> {
	const fetched = vi.fn(async () => {
		await Promise.reject(new TypeError('fetch failed'));
	});

	vi.stubGlobal('fetch', fetched);

	return fetched;
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

	it('leaves records dirty and stays quiet when the network is down', async () => {
		failing();

		const workout = lift();
		await store.finishWorkout(workout, 23_456);

		await expect(syncNow(userId, store)).resolves.toBe('unreachable');

		const dirty = await store.dirtyRecords();
		expect(dirty.some((r) => r.id === workout.id)).toBe(true);
	});

	it('refuses to sync a store owned by someone else', async () => {
		await store.claimOwner(userId);

		const workout = lift();
		await store.finishWorkout(workout, 34_567);

		expect(await syncNow('someone-else', store)).toBe('other-account');

		const dirty = await store.dirtyRecords();
		expect(dirty.some((r) => r.id === workout.id)).toBe(true);
	});

	it('stamps the store when an exchange lands, and leaves it alone when one does not', async () => {
		await store.finishWorkout(lift(), 45_678);

		await syncNow(userId, store);

		const stamped = await store.syncedAt();
		expect(stamped).not.toBeNull();

		failing();

		await store.finishWorkout(lift(), 56_789);
		await syncNow(userId, store);

		expect(await store.syncedAt()).toBe(stamped);
	});
});

describe('what sync has to say for itself', () => {
	it('counts nothing pending and names the moment it landed', async () => {
		await store.finishWorkout(lift(), 12_345);

		await syncNow(userId, store);

		const status = syncStatus();
		expect(status.pending).toBe(0);
		expect(status.stall).toBeNull();
		expect(status.busy).toBe(false);
		expect(status.syncedAt).not.toBeNull();
	});

	it('counts what is waiting and calls an unanswered server a passing thing', async () => {
		failing();

		await store.finishWorkout(lift(), 23_456);

		await syncNow(userId, store);

		const status = syncStatus();
		expect(status.pending).toBe(1);
		expect(status.stall).toBe('unreachable');
		expect(healsItself(status.stall)).toBe(true);
	});

	// The one that was invisible: `request` drops the device token on a 401, so every
	// later attempt fails the same way with nothing on screen to say so.
	it('names a dropped credential as a dead end rather than a passing one', async () => {
		setDeviceToken('a-device-token');

		vi.stubGlobal(
			'fetch',
			vi.fn(() => Response.json({ message: 'unauthorized' }, { status: 401 }))
		);

		await store.finishWorkout(lift(), 34_567);

		expect(await syncNow(userId, store)).toBe('signed-out');

		expect(syncStatus().stall).toBe('signed-out');
		expect(healsItself(syncStatus().stall)).toBe(false);
	});

	it('names having no server as a dead end too', async () => {
		setApiBase(null);

		// `apiBase()` falls back to the page's own origin off the app build; a null one
		// stands in for the packaged app, where it is null until a server is named.
		vi.stubGlobal('location', { origin: null });

		await store.finishWorkout(lift(), 45_678);

		expect(await syncNow(userId, store)).toBe('no-server');

		expect(syncStatus().stall).toBe('no-server');
		expect(healsItself(syncStatus().stall)).toBe(false);
	});

	it('counts what is waiting without going near the network', async () => {
		await store.finishWorkout(lift(), 56_789);

		const fetched = vi.fn();
		vi.stubGlobal('fetch', fetched);

		await readSyncState(store);

		expect(syncStatus().pending).toBe(1);
		expect(fetched).not.toHaveBeenCalled();
	});
});

// These drive the module's own scheduling, so they run against the singleton store
// `drain` reaches for rather than the isolated one the exchange tests hand in.
describe('when sync comes back for another go', () => {
	async function planted(): Promise<Store> {
		const singleton = await getStore();

		await singleton.wipe(userId);
		await singleton.finishWorkout(lift(), 1000);

		return singleton;
	}

	it('drops a debounced sync when the account leaves', async () => {
		await planted();

		const fetched = failing();

		freeze();

		syncSoon(userId);
		stopSyncing();

		await vi.advanceTimersByTimeAsync(10_000);

		expect(fetched).not.toHaveBeenCalled();
	});

	it('lines up another attempt while records are still waiting', async () => {
		await planted();

		failing();

		freeze();

		syncPromptly(userId);

		await settled(() => syncStatus().stall !== null);

		expect(syncStatus().pending).toBe(1);
		expect(syncStatus().stall).toBe('unreachable');
		expect(vi.getTimerCount()).toBeGreaterThan(0);
	});

	// The gap this closes: before it, a failed sync sat until the next write or the
	// next launch, and the phone said nothing in between.
	it('takes that attempt when the rung comes up', async () => {
		await planted();

		const fetched = failing();

		freeze();

		syncPromptly(userId);

		// Until the attempt has fully settled there is no retry on the clock yet, and
		// advancing past a timer that does not exist proves nothing.
		await settled(() => vi.getTimerCount() > 0);

		const first = fetched.mock.calls.length;

		await vi.advanceTimersByTimeAsync(5000);

		// The rung fires the attempt; the exchange behind it still has a store to walk.
		await settled(() => fetched.mock.calls.length > first);

		expect(fetched.mock.calls.length).toBeGreaterThan(first);
	});

	it('lines up nothing once there is nothing left to send', async () => {
		const singleton = await getStore();

		await singleton.wipe(userId);

		freeze();

		syncPromptly(userId);

		await settled(() => !syncStatus().busy && syncStatus().syncedAt !== null);

		expect(syncStatus().pending).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
	});
});
