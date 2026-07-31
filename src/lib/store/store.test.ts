import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import type { Workout, WorkoutSet } from '$lib/domain/workout';
import type { WireRecord } from '$lib/sync/protocol';

import { openDatabase } from './db.ts';
import { Store } from './store.ts';

/**
 * Against fake-indexeddb, which implements the real structured-clone,
 * transaction and index semantics in memory — so these tests exercise the
 * actual IndexedDB code paths, not a mock of the store's own interface.
 */

let counter = 0;

/** A fresh, uniquely named database per test: isolation without deletion. */
async function freshStore(): Promise<Store> {
	counter += 1;

	return new Store(await openDatabase(`kilorep-test-${counter}`));
}

type SetSpec = {
	weight: number;
	reps: number;
	type?: WorkoutSet['type'];
	completed?: boolean;
};

const set = (spec: SetSpec, id: string): WorkoutSet => ({
	id,
	type: spec.type ?? 'normal',
	plannedReps: null,
	weight: spec.weight,
	reps: spec.reps,
	completed: spec.completed ?? true
});

/** One exercise, one entry — the shape almost every derivation case needs. */
function workout(id: string, startedAt: number, exerciseId: string, sets: SetSpec[]): Workout {
	return {
		id,
		startedAt,
		entries: [
			{
				id: `${id}-entry`,
				exercises: [
					{
						id: `${id}-node`,
						exerciseId,
						sets: sets.map((spec, i) => set(spec, `${id}-set-${i}`))
					}
				]
			}
		]
	};
}

const wire = (id: string, updatedAt: number, payload: unknown): WireRecord => ({
	id,
	kind: 'workout',
	updatedAt,
	deletedAt: null,
	payload
});

/** A remote copy of a workout: the payload as another device would have written it. */
const finished = (w: Workout, finishedAt: number): unknown => ({
	id: w.id,
	startedAt: w.startedAt,
	entries: w.entries,
	finishedAt
});

describe('workouts', () => {
	let store: Store;

	beforeEach(async () => {
		store = await freshStore();
	});

	it('round-trips a finished workout', async () => {
		await store.finishWorkout(workout('w1', 100, 'bench-press', [{ weight: 80, reps: 8 }]), 200);

		const listed = await store.listWorkouts();

		expect(listed).toHaveLength(1);
		expect(listed[0].id).toBe('w1');
		expect(listed[0].finishedAt).toBe(200);
	});

	it('lists oldest first regardless of finish order', async () => {
		await store.finishWorkout(workout('late', 300, 'bench-press', []), 400);
		await store.finishWorkout(workout('early', 100, 'bench-press', []), 500);

		const listed = await store.listWorkouts();

		expect(listed.map((w) => w.id)).toEqual(['early', 'late']);
	});

	it('hides tombstoned workouts', async () => {
		await store.finishWorkout(workout('w1', 100, 'bench-press', []), 200);
		await store.applyRemote([Object.assign(wire('w1', 300, null), { deletedAt: 300 })]);

		expect(await store.listWorkouts()).toEqual([]);
	});
});

describe('history derivation', () => {
	let store: Store;

	beforeEach(async () => {
		store = await freshStore();
	});

	it('counts completed working sets only', async () => {
		await store.finishWorkout(
			workout('w1', 100, 'bench-press', [
				{ weight: 40, reps: 10, type: 'warmup' },
				{ weight: 80, reps: 8 },
				{ weight: 80, reps: 6, completed: false },
				{ weight: 77.5, reps: 8 }
			]),
			200
		);

		const history = await store.history();

		expect(history['bench-press']).toEqual([
			{ weight: 80, reps: 8 },
			{ weight: 77.5, reps: 8 }
		]);
	});

	it('recalls the last workout that performed the exercise, not the last workout', async () => {
		await store.finishWorkout(workout('w1', 100, 'bench-press', [{ weight: 80, reps: 8 }]), 150);
		await store.finishWorkout(workout('w2', 200, 'cable-fly', [{ weight: 20, reps: 12 }]), 250);

		const history = await store.history();

		expect(history['bench-press']).toEqual([{ weight: 80, reps: 8 }]);
	});

	it('treats an exercise with nothing completed as never performed', async () => {
		await store.finishWorkout(
			workout('w1', 100, 'bench-press', [{ weight: 80, reps: 8, completed: false }]),
			200
		);

		expect(await store.history()).toEqual({});
	});

	it('keeps the earlier session when a later workout completed nothing', async () => {
		await store.finishWorkout(workout('w1', 100, 'bench-press', [{ weight: 80, reps: 8 }]), 150);
		await store.finishWorkout(
			workout('w2', 200, 'bench-press', [{ weight: 85, reps: 5, completed: false }]),
			250
		);

		const history = await store.history();

		expect(history['bench-press']).toEqual([{ weight: 80, reps: 8 }]);
	});
});

describe('past sessions', () => {
	it('returns one exercise, oldest first, dated by session start', async () => {
		const store = await freshStore();

		await store.finishWorkout(workout('w2', 200, 'bench-press', [{ weight: 82.5, reps: 6 }]), 250);
		await store.finishWorkout(workout('w1', 100, 'bench-press', [{ weight: 80, reps: 8 }]), 150);
		await store.finishWorkout(workout('w3', 300, 'cable-fly', [{ weight: 20, reps: 12 }]), 350);

		const past = await store.pastSessions('bench-press');

		expect(past).toEqual([
			{ date: 100, sets: [{ weight: 80, reps: 8 }] },
			{ date: 200, sets: [{ weight: 82.5, reps: 6 }] }
		]);
	});
});

describe('the active session snapshot', () => {
	it('round-trips and clears', async () => {
		const store = await freshStore();
		const snapshot = {
			workout: workout('w1', 100, 'bench-press', [{ weight: 80, reps: 8, completed: false }]),
			activeSetId: 'w1-set-0'
		};

		expect(await store.loadSnapshot()).toBeNull();

		await store.saveSnapshot(snapshot);
		expect(await store.loadSnapshot()).toEqual(snapshot);

		await store.clearSnapshot();
		expect(await store.loadSnapshot()).toBeNull();
	});
});

describe('sync bookkeeping', () => {
	let store: Store;

	beforeEach(async () => {
		store = await freshStore();
	});

	it('exposes dirty records in wire shape, without the flag', async () => {
		await store.finishWorkout(workout('w1', 100, 'bench-press', []), 200);

		const dirty = await store.dirtyRecords();

		expect(dirty).toHaveLength(1);
		expect(dirty[0].id).toBe('w1');
		expect(dirty[0].updatedAt).toBe(200);
		expect('dirty' in dirty[0]).toBe(false);
	});

	it('acknowledge settles only the exact version that was pushed', async () => {
		await store.finishWorkout(workout('w1', 100, 'bench-press', []), 200);
		// An edit lands while the push is in flight: same id, newer updatedAt.
		await store.finishWorkout(workout('w1', 100, 'bench-press', []), 300);

		await store.acknowledge([{ id: 'w1', updatedAt: 200 }]);
		expect(await store.dirtyRecords()).toHaveLength(1);

		await store.acknowledge([{ id: 'w1', updatedAt: 300 }]);
		expect(await store.dirtyRecords()).toEqual([]);
	});

	it('applyRemote lets a newer remote overwrite and an older one bounce', async () => {
		await store.finishWorkout(workout('w1', 100, 'bench-press', [{ weight: 80, reps: 8 }]), 200);
		await store.acknowledge([{ id: 'w1', updatedAt: 200 }]);

		const older = workout('w1', 100, 'bench-press', [{ weight: 70, reps: 8 }]);
		await store.applyRemote([wire('w1', 150, finished(older, 150))]);

		let listed = await store.listWorkouts();
		expect(listed[0].finishedAt).toBe(200);

		const newer = workout('w1', 100, 'bench-press', [{ weight: 85, reps: 8 }]);
		await store.applyRemote([wire('w1', 400, finished(newer, 400))]);

		listed = await store.listWorkouts();
		expect(listed[0].finishedAt).toBe(400);
		expect(await store.dirtyRecords()).toEqual([]);
	});

	it('applyRemote settles a tie clean — the superseded-push echo', async () => {
		await store.finishWorkout(workout('w1', 100, 'bench-press', []), 200);

		const echo = finished(workout('w1', 100, 'bench-press', []), 200);
		await store.applyRemote([wire('w1', 200, echo)]);

		expect(await store.dirtyRecords()).toEqual([]);
	});

	it('keeps a strictly newer local record over a remote echo', async () => {
		await store.finishWorkout(workout('w1', 100, 'bench-press', []), 300);

		const echo = finished(workout('w1', 100, 'bench-press', []), 250);
		await store.applyRemote([wire('w1', 250, echo)]);

		const listed = await store.listWorkouts();
		expect(listed[0].finishedAt).toBe(300);
		expect(await store.dirtyRecords()).toHaveLength(1);
	});

	it('watermark defaults to zero and round-trips', async () => {
		expect(await store.watermark()).toBe(0);

		await store.setWatermark(42);
		expect(await store.watermark()).toBe(42);
	});

	it('claimOwner claims once and refuses a different account', async () => {
		expect(await store.claimOwner('user-a')).toBe(true);
		expect(await store.claimOwner('user-a')).toBe(true);
		expect(await store.claimOwner('user-b')).toBe(false);
	});
});
