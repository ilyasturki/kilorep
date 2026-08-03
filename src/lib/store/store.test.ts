import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import type { Template } from '$lib/domain/template';
import type { Workout, WorkoutSet } from '$lib/domain/workout';
import type { WireRecord } from '$lib/sync/protocol';

import { openDatabase } from './db.ts';
import { frequentFrom, hintsOf } from './derive.ts';
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
		templateId: null,
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
	templateId: w.templateId,
	startedAt: w.startedAt,
	entries: w.entries,
	finishedAt
});

const template = (id: string, createdAt: number, name = 'Push day'): Template => ({
	id,
	name,
	createdAt,
	entries: []
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

	it('gets one workout by id, and null for unknown, deleted or wrong-kind ids', async () => {
		await store.finishWorkout(workout('w1', 100, 'bench-press', []), 200);
		await store.saveTemplate(template('t1', 100), 150);

		expect(await store.getWorkout('w1')).toMatchObject({ finishedAt: 200 });
		expect(await store.getWorkout('missing')).toBeNull();
		expect(await store.getWorkout('t1')).toBeNull();

		await store.deleteWorkout('w1', 300);

		expect(await store.getWorkout('w1')).toBeNull();
	});

	it('updates in place: new tree, same ending, dirty again', async () => {
		await store.finishWorkout(workout('w1', 100, 'bench-press', [{ weight: 80, reps: 8 }]), 200);
		await store.acknowledge([{ id: 'w1', updatedAt: 200 }]);

		const stored = await store.getWorkout('w1');

		if (stored === null) {
			throw new Error('the workout just written is missing');
		}

		stored.entries[0].exercises[0].sets[0].weight = 100;

		await store.updateWorkout(stored, 400);

		const listed = await store.listWorkouts();

		expect(listed[0].entries[0].exercises[0].sets[0].weight).toBe(100);
		// The correction is not a second ending, and it does not move the session.
		expect(listed[0].finishedAt).toBe(200);
		expect(listed[0].startedAt).toBe(100);

		const dirty = await store.dirtyRecords();

		expect(dirty).toHaveLength(1);
		expect(dirty[0]).toMatchObject({ id: 'w1', updatedAt: 400, deletedAt: null });
	});

	// The whole reason the write reads the record first: blind, it would put
	// `deletedAt: null` over a tombstone that arrived while the screen was open.
	it('an update never resurrects a tombstoned workout', async () => {
		await store.finishWorkout(workout('w1', 100, 'bench-press', [{ weight: 80, reps: 8 }]), 200);

		const stored = await store.getWorkout('w1');

		if (stored === null) {
			throw new Error('the workout just written is missing');
		}

		await store.applyRemote([Object.assign(wire('w1', 300, null), { deletedAt: 300 })]);
		await store.updateWorkout(stored, 400);

		expect(await store.getWorkout('w1')).toBeNull();
		expect(await store.listWorkouts()).toEqual([]);
	});

	it('updating an unknown or wrong-kind id writes nothing', async () => {
		await store.saveTemplate(template('t1', 100), 150);
		await store.acknowledge([{ id: 't1', updatedAt: 150 }]);

		const absent = Object.assign(workout('missing', 100, 'bench-press', []), { finishedAt: 200 });
		const wrongKind = Object.assign(workout('t1', 100, 'bench-press', []), { finishedAt: 200 });

		await store.updateWorkout(absent, 400);
		await store.updateWorkout(wrongKind, 400);

		expect(await store.getWorkout('missing')).toBeNull();
		expect(await store.getTemplate('t1')).not.toBeNull();
		expect(await store.dirtyRecords()).toEqual([]);
	});

	it('deletes by tombstone: dirty, stamped, and gone from every read', async () => {
		await store.finishWorkout(workout('w1', 100, 'bench-press', [{ weight: 80, reps: 8 }]), 200);
		await store.acknowledge([{ id: 'w1', updatedAt: 200 }]);

		await store.deleteWorkout('w1', 300);

		expect(await store.listWorkouts()).toEqual([]);
		expect(await store.history()).toEqual({});

		const dirty = await store.dirtyRecords();

		expect(dirty).toHaveLength(1);
		expect(dirty[0]).toMatchObject({ id: 'w1', deletedAt: 300, updatedAt: 300 });
	});

	it('deleting an unknown or wrong-kind id writes nothing', async () => {
		await store.saveTemplate(template('t1', 100), 150);
		await store.acknowledge([{ id: 't1', updatedAt: 150 }]);

		await store.deleteWorkout('missing', 300);
		await store.deleteWorkout('t1', 300);

		expect(await store.getTemplate('t1')).not.toBeNull();
		expect(await store.dirtyRecords()).toEqual([]);
	});
});

describe('templates', () => {
	let store: Store;

	beforeEach(async () => {
		store = await freshStore();
	});

	it('round-trips a template and re-saves in place', async () => {
		await store.saveTemplate(template('t1', 100), 150);
		await store.saveTemplate(template('t1', 100, 'Push day A'), 250);

		const listed = await store.listTemplates();

		expect(listed).toHaveLength(1);
		expect(listed[0].name).toBe('Push day A');
		expect(await store.getTemplate('t1')).not.toBeNull();
	});

	it('lists in creation order regardless of save order', async () => {
		await store.saveTemplate(template('late', 300), 400);
		await store.saveTemplate(template('early', 100), 500);

		const listed = await store.listTemplates();

		expect(listed.map((t) => t.id)).toEqual(['early', 'late']);
	});

	it('deletes as a tombstone that wins last-write-wins', async () => {
		await store.saveTemplate(template('t1', 100), 150);
		await store.deleteTemplate('t1', 300);

		expect(await store.listTemplates()).toEqual([]);
		expect(await store.getTemplate('t1')).toBeNull();

		// The tombstone still owes a push, stamped with the delete's own time —
		// an old `updatedAt` would lose to the server's live copy and undelete.
		const dirty = await store.dirtyRecords();
		const record = dirty.find((r) => r.id === 't1');

		expect(record).toMatchObject({ deletedAt: 300, updatedAt: 300 });
	});

	it('refuses to tombstone a record of another kind', async () => {
		await store.finishWorkout(workout('w1', 100, 'bench-press', []), 200);
		await store.deleteTemplate('w1', 300);

		expect(await store.listWorkouts()).toHaveLength(1);
	});

	it('keeps kinds isolated in the shared records box', async () => {
		await store.saveTemplate(template('t1', 100), 150);
		await store.finishWorkout(workout('w1', 100, 'bench-press', []), 200);
		await store.deleteTemplate('t1', 300);

		expect(await store.listWorkouts()).toHaveLength(1);
		expect(await store.listTemplates()).toEqual([]);
	});
});

describe('body weight', () => {
	let store: Store;

	beforeEach(async () => {
		store = await freshStore();
	});

	it('round-trips an entry and overwrites the same day in place', async () => {
		await store.saveBodyweight({ date: '2026-08-02', kg: 80.4 }, 100);
		await store.saveBodyweight({ date: '2026-08-02', kg: 80.1 }, 200);

		expect(await store.listBodyweight()).toEqual([{ date: '2026-08-02', kg: 80.1 }]);
	});

	it('lists oldest day first regardless of save order', async () => {
		await store.saveBodyweight({ date: '2026-08-02', kg: 80 }, 100);
		await store.saveBodyweight({ date: '2026-07-28', kg: 80.6 }, 200);

		const listed = await store.listBodyweight();

		expect(listed.map((entry) => entry.date)).toEqual(['2026-07-28', '2026-08-02']);
	});

	it('deletes as a tombstone that wins last-write-wins', async () => {
		await store.saveBodyweight({ date: '2026-08-02', kg: 80 }, 100);
		await store.deleteBodyweight('2026-08-02', 300);

		expect(await store.listBodyweight()).toEqual([]);

		const dirty = await store.dirtyRecords();
		const record = dirty.find((r) => r.id === 'bodyweight-2026-08-02');

		expect(record).toMatchObject({ deletedAt: 300, updatedAt: 300 });
	});

	it('re-logging a deleted day resurrects it, deliberately', async () => {
		await store.saveBodyweight({ date: '2026-08-02', kg: 80 }, 100);
		await store.deleteBodyweight('2026-08-02', 200);
		await store.saveBodyweight({ date: '2026-08-02', kg: 80.2 }, 300);

		expect(await store.listBodyweight()).toEqual([{ date: '2026-08-02', kg: 80.2 }]);
	});

	it('stays out of the other kinds in the shared records box', async () => {
		await store.saveBodyweight({ date: '2026-08-02', kg: 80 }, 100);
		await store.finishWorkout(workout('w1', 100, 'bench-press', []), 200);

		expect(await store.listBodyweight()).toHaveLength(1);
		expect(await store.listWorkouts()).toHaveLength(1);
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

describe('last performed', () => {
	let store: Store;

	beforeEach(async () => {
		store = await freshStore();
	});

	it('dates the last session by its start, not its finish', async () => {
		await store.finishWorkout(workout('w1', 100, 'bench-press', [{ weight: 80, reps: 8 }]), 150);

		expect(await store.lastPerformed()).toEqual({
			'bench-press': { date: 100, workoutId: 'w1', position: 1, sets: [{ weight: 80, reps: 8 }] }
		});
	});

	it('recalls the last workout that performed the exercise, whatever order they arrived in', async () => {
		await store.finishWorkout(workout('w2', 200, 'bench-press', [{ weight: 85, reps: 5 }]), 250);
		await store.finishWorkout(workout('w1', 100, 'bench-press', [{ weight: 80, reps: 8 }]), 150);

		const last = await store.lastPerformed();

		expect(last['bench-press']).toEqual({
			date: 200,
			workoutId: 'w2',
			position: 1,
			sets: [{ weight: 85, reps: 5 }]
		});
	});

	it('is absent for an exercise with nothing completed, the shape a row reads as never trained', async () => {
		await store.finishWorkout(
			workout('w1', 100, 'bench-press', [{ weight: 80, reps: 8, completed: false }]),
			200
		);

		expect(await store.lastPerformed()).toEqual({});
	});

	it('agrees with the hint map it projects', async () => {
		await store.finishWorkout(
			workout('w1', 100, 'bench-press', [
				{ weight: 40, reps: 10, type: 'warmup' },
				{ weight: 80, reps: 8 }
			]),
			150
		);
		await store.finishWorkout(workout('w2', 200, 'cable-fly', [{ weight: 20, reps: 12 }]), 250);

		expect(hintsOf(await store.lastPerformed())).toEqual(await store.history());
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
			{ date: 100, workoutId: 'w1', position: 1, sets: [{ weight: 80, reps: 8 }] },
			{ date: 200, workoutId: 'w2', position: 1, sets: [{ weight: 82.5, reps: 6 }] }
		]);
	});

	it('counts the ordinal across every exercise the workout holds, performed or not', async () => {
		const store = await freshStore();

		// Three exercises in session order, the middle one never completed: the
		// ordinal must still say "3rd", because that is where the exercise sits
		// on the workout screen the id links to.
		const w = workout('w1', 100, 'bench-press', [{ weight: 80, reps: 8 }]);
		w.entries.push(
			{
				id: 'w1-entry-2',
				exercises: [
					{
						id: 'w1-node-2',
						exerciseId: 'cable-fly',
						sets: [set({ weight: 20, reps: 12, completed: false }, 'w1-fly-1')]
					}
				]
			},
			{
				id: 'w1-entry-3',
				exercises: [
					{
						id: 'w1-node-3',
						exerciseId: 'pec-deck',
						sets: [set({ weight: 50, reps: 10 }, 'w1-pec-1')]
					}
				]
			}
		);
		await store.finishWorkout(w, 150);

		expect(await store.pastSessions('pec-deck')).toEqual([
			{ date: 100, workoutId: 'w1', position: 3, sets: [{ weight: 50, reps: 10 }] }
		]);

		// The projection agrees: same workout, same ordinal.
		const projected = await store.lastPerformed();

		expect(projected['pec-deck']!.position).toBe(3);
	});
});

describe('frequent exercises', () => {
	/**
	 * One workout, one exercise per entry, one completed set each — the shelf
	 * counts sessions, so what those sets hold never matters. `done: false`
	 * leaves the whole session logged but uncompleted, which is the state that
	 * must not count as training.
	 */
	function session(id: string, startedAt: number, exerciseIds: string[], done = true): Workout {
		return {
			id,
			templateId: null,
			startedAt,
			entries: exerciseIds.map((exerciseId, i) => ({
				id: `${id}-entry-${i}`,
				exercises: [
					{
						id: `${id}-node-${i}`,
						exerciseId,
						sets: [set({ weight: 80, reps: 8, completed: done }, `${id}-set-${i}`)]
					}
				]
			}))
		};
	}

	it('ranks by how many sessions hold the exercise, most first', async () => {
		const store = await freshStore();

		await store.finishWorkout(session('w1', 100, ['bench-press', 'cable-fly']), 150);
		await store.finishWorkout(session('w2', 200, ['bench-press', 'pec-deck']), 250);
		await store.finishWorkout(session('w3', 300, ['bench-press']), 350);

		expect(frequentFrom(await store.listWorkouts())).toEqual([
			'bench-press',
			'pec-deck',
			'cable-fly'
		]);
	});

	it('breaks a tie towards the more recent', async () => {
		const store = await freshStore();

		await store.finishWorkout(session('w1', 100, ['cable-fly']), 150);
		await store.finishWorkout(session('w2', 200, ['pec-deck']), 250);

		expect(frequentFrom(await store.listWorkouts())).toEqual(['pec-deck', 'cable-fly']);
	});

	it('counts an exercise performed twice in one session once', async () => {
		const store = await freshStore();

		// Two entries, same exercise — a session that came back to the rack, not
		// two sessions.
		await store.finishWorkout(session('w1', 100, ['bench-press', 'bench-press']), 150);
		await store.finishWorkout(session('w2', 200, ['cable-fly']), 250);

		expect(frequentFrom(await store.listWorkouts())).toEqual(['cable-fly', 'bench-press']);
	});

	it('ignores an exercise nothing was completed on', async () => {
		const store = await freshStore();

		await store.finishWorkout(session('w1', 100, ['bench-press'], false), 150);
		await store.finishWorkout(session('w2', 200, ['cable-fly']), 250);

		expect(frequentFrom(await store.listWorkouts())).toEqual(['cable-fly']);
	});

	it('looks ten sessions back and no further', async () => {
		const store = await freshStore();

		// Eleven workouts, the oldest the only one holding the fly: it falls out
		// of the window the eleventh pushes it past.
		await store.finishWorkout(session('w0', 100, ['cable-fly']), 150);

		for (let i = 1; i <= 10; i += 1) {
			await store.finishWorkout(session(`w${i}`, 100 + i * 100, ['bench-press']), 150 + i * 100);
		}

		expect(frequentFrom(await store.listWorkouts())).toEqual(['bench-press']);
	});

	it('shelves nothing on a fresh install', async () => {
		const store = await freshStore();

		expect(frequentFrom(await store.listWorkouts())).toEqual([]);
	});

	it('caps the shelf', async () => {
		const store = await freshStore();

		await store.finishWorkout(session('w1', 100, ['a', 'b', 'c']), 150);

		expect(frequentFrom(await store.listWorkouts(), 2)).toEqual(['a', 'b']);
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

	it('owner reports the stamp without making one', async () => {
		expect(await store.owner()).toBeNull();
		// Asking must not be answering: the sign-in screen reads this before it
		// knows whether it has a choice to offer.
		expect(await store.owner()).toBeNull();

		await store.claimOwner('user-a');
		expect(await store.owner()).toBe('user-a');
	});
});

describe('changing hands', () => {
	let store: Store;

	beforeEach(async () => {
		store = await freshStore();

		await store.finishWorkout(workout('w1', 100, 'bench-press', [{ weight: 80, reps: 8 }]), 200);
		await store.acknowledge([{ id: 'w1', updatedAt: 200 }]);
		await store.setWatermark(42);
		await store.claimOwner('user-a');
	});

	it('adopt re-dirties everything the old account had settled', async () => {
		expect(await store.dirtyRecords()).toEqual([]);

		await store.adopt('user-b');

		// The ack that settled this record was the other account's and means
		// nothing here, so the push has to happen again.
		const dirty = await store.dirtyRecords();
		expect(dirty).toHaveLength(1);
		expect(dirty[0].id).toBe('w1');
	});

	it('adopt keeps the records and re-stamps the owner from zero', async () => {
		await store.adopt('user-b');

		expect(await store.listWorkouts()).toHaveLength(1);
		expect(await store.owner()).toBe('user-b');
		// Counted on the old account's counter, so it names nothing on the new one.
		expect(await store.watermark()).toBe(0);
		expect(await store.claimOwner('user-b')).toBe(true);
	});

	it('wipe empties the device, snapshot included', async () => {
		await store.saveSnapshot({
			workout: workout('live', 900, 'squat', [{ weight: 100, reps: 5 }]),
			activeSetId: null
		});

		await store.wipe('user-b');

		expect(await store.listWorkouts()).toEqual([]);
		expect(await store.dirtyRecords()).toEqual([]);
		expect(await store.loadSnapshot()).toBeNull();
		expect(await store.watermark()).toBe(0);
		expect(await store.owner()).toBe('user-b');
	});

	it('either way the store syncs as the new account afterwards', async () => {
		expect(await store.claimOwner('user-b')).toBe(false);

		await store.adopt('user-b');
		expect(await store.claimOwner('user-b')).toBe(true);
		expect(await store.claimOwner('user-a')).toBe(false);
	});
});
