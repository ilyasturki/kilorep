import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import type { Template } from '$lib/domain/template';
import type { Workout, WorkoutSet } from '$lib/domain/workout';
import type { WireRecord } from '$lib/sync/protocol';

import { openDatabase } from './db.ts';
import { frequentFrom, hintsOf } from './derive.ts';
import { Store } from './store.ts';

let counter = 0;

async function freshStore(): Promise<Store> {
	counter += 1;

	return new Store(await openDatabase(`kilorep-test-${counter}`));
}

let store: Store;

beforeEach(async () => {
	store = await freshStore();
});

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
	rpe: null,
	completed: spec.completed ?? true
});

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

const wire = (
	id: string,
	updatedAt: number,
	payload: unknown,
	kind: WireRecord['kind'] = 'workout',
	deletedAt: number | null = null
): WireRecord => ({ id, kind, updatedAt, deletedAt, payload });

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
		await store.applyRemote([wire('w1', 300, null, 'workout', 300)]);

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

		const stored = (await store.getWorkout('w1'))!;

		stored.entries[0].exercises[0].sets[0].weight = 100;

		await store.updateWorkout(stored, 400);

		const listed = await store.listWorkouts();

		expect(listed[0].entries[0].exercises[0].sets[0].weight).toBe(100);
		expect(listed[0].finishedAt).toBe(200);
		expect(listed[0].startedAt).toBe(100);

		const dirty = await store.dirtyRecords();

		expect(dirty).toHaveLength(1);
		expect(dirty[0]).toMatchObject({ id: 'w1', updatedAt: 400, deletedAt: null });
	});

	it('an update never resurrects a tombstoned workout', async () => {
		await store.finishWorkout(workout('w1', 100, 'bench-press', [{ weight: 80, reps: 8 }]), 200);

		const stored = (await store.getWorkout('w1'))!;

		await store.applyRemote([wire('w1', 300, null, 'workout', 300)]);
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

	it('an explicit order outranks the birthday it stands in for', async () => {
		const placed = template('new', 300);

		placed.order = 50;

		await store.saveTemplate(template('old', 100), 400);
		await store.saveTemplate(placed, 600);

		const listed = await store.listTemplates();

		expect(listed.map((t) => t.id)).toEqual(['new', 'old']);
	});

	// `saveTemplate` builds its payload field by field rather than copying the
	// object, so every field added to `Template` has to be added there too or it
	// is dropped silently on the way to disk. This is the test that says so.
	it('persists the mark, the order and the archive stamp', async () => {
		const marked = template('t1', 100);

		marked.mark = { icon: 'push', colour: 'blue' };
		marked.order = 42;
		marked.archivedAt = 900;

		await store.saveTemplate(marked, 150);

		const stored = await store.getTemplate('t1');

		expect(stored).toMatchObject({
			mark: { icon: 'push', colour: 'blue' },
			order: 42,
			archivedAt: 900
		});
	});

	it('an archived template is still listed', async () => {
		const put = template('t1', 100);

		put.archivedAt = 900;

		await store.saveTemplate(put, 150);

		const listed = await store.listTemplates();

		expect(listed.map((t) => t.id)).toEqual(['t1']);
	});

	it('unarchiving clears the stamp rather than dropping the field', async () => {
		const put = template('t1', 100);
		const back = template('t1', 100);

		put.archivedAt = 900;
		back.archivedAt = null;

		await store.saveTemplate(put, 150);
		await store.saveTemplate(back, 250);

		const stored = await store.getTemplate('t1');

		expect(stored).toMatchObject({ archivedAt: null });
	});

	it('deletes as a tombstone that wins last-write-wins', async () => {
		await store.saveTemplate(template('t1', 100), 150);
		await store.deleteTemplate('t1', 300);

		expect(await store.listTemplates()).toEqual([]);
		expect(await store.getTemplate('t1')).toBeNull();

		const dirty = await store.dirtyRecords();
		const record = dirty.find((r) => r.id === 't1');

		expect(record).toMatchObject({ deletedAt: 300, updatedAt: 300 });
	});

	it('keeps kinds isolated in the shared records box', async () => {
		await store.saveTemplate(template('t1', 100), 150);
		await store.finishWorkout(workout('w1', 100, 'bench-press', []), 200);

		await store.deleteTemplate('w1', 300);
		await store.deleteTemplate('t1', 300);

		expect(await store.listWorkouts()).toHaveLength(1);
		expect(await store.listTemplates()).toEqual([]);
	});
});

describe('body weight', () => {
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
});

describe('dropping the retired main variants', () => {
	it('buries every one as a tombstone the next sync carries', async () => {
		await store.applyRemote([
			wire('main-variant:squat', 50, { family: 'squat', main: 'front-squat' }, 'preference'),
			wire('main-variant:deadlift', 60, { family: 'deadlift', main: 'sumo-deadlift' }, 'preference')
		]);

		await store.dropMainVariants(900);

		expect(await store.dirtyRecords()).toEqual([
			{
				id: 'main-variant:deadlift',
				kind: 'preference',
				updatedAt: 900,
				deletedAt: 900,
				payload: { family: 'deadlift', main: 'sumo-deadlift' }
			},
			{
				id: 'main-variant:squat',
				kind: 'preference',
				updatedAt: 900,
				deletedAt: 900,
				payload: { family: 'squat', main: 'front-squat' }
			}
		]);
	});

	it('leaves every other preference alone', async () => {
		await store.setExertionScale('rir', 100);
		await store.dropMainVariants(900);

		expect(await store.exertionScale()).toBe('rir');
		expect(await store.dirtyRecords()).toMatchObject([{ id: 'exertion-scale', deletedAt: null }]);
	});

	it('is idempotent: a second pass re-stamps nothing', async () => {
		await store.applyRemote([
			wire('main-variant:squat', 50, { family: 'squat', main: 'front-squat' }, 'preference')
		]);

		await store.dropMainVariants(900);
		await store.dropMainVariants(1000);

		expect(await store.dirtyRecords()).toMatchObject([{ updatedAt: 900, deletedAt: 900 }]);
	});

	it('buries again a choice an old device pushed back with a fresher clock', async () => {
		await store.applyRemote([
			wire('main-variant:squat', 50, { family: 'squat', main: 'front-squat' }, 'preference')
		]);
		await store.dropMainVariants(900);

		await store.applyRemote([
			wire('main-variant:squat', 1500, { family: 'squat', main: 'front-squat' }, 'preference')
		]);
		await store.dropMainVariants(2000);

		expect(await store.dirtyRecords()).toMatchObject([{ updatedAt: 2000, deletedAt: 2000 }]);
	});
});

describe('exertion scale', () => {
	it('is RPE for an account that has never said, without writing a record', async () => {
		expect(await store.exertionScale()).toBe('rpe');
		expect(await store.dirtyRecords()).toEqual([]);
	});

	it('round-trips a choice as a record born dirty and syncable', async () => {
		await store.setExertionScale('rir', 100);

		expect(await store.exertionScale()).toBe('rir');

		expect(await store.dirtyRecords()).toEqual([
			wire('exertion-scale', 100, { scale: 'rir' }, 'preference')
		]);
	});

	it('re-choosing overwrites in place: there is only ever one', async () => {
		await store.setExertionScale('rir', 100);
		await store.setExertionScale('rpe', 200);

		expect(await store.exertionScale()).toBe('rpe');
		expect(await store.dirtyRecords()).toHaveLength(1);
	});

	it('falls back rather than widening to a scale it cannot render', async () => {
		await store.applyRemote([wire('exertion-scale', 50, { scale: 'borg' }, 'preference')]);

		expect(await store.exertionScale()).toBe('rpe');
	});

	it('reads a tombstoned choice as never chosen', async () => {
		await store.applyRemote([wire('exertion-scale', 50, { scale: 'rir' }, 'preference', 60)]);

		expect(await store.exertionScale()).toBe('rpe');
	});
});

describe('exercise notes', () => {
	it('is empty for an exercise nobody has written about, without writing a record', async () => {
		expect(await store.exerciseNote('bench-press')).toBe('');
		expect(await store.dirtyRecords()).toEqual([]);
	});

	it('round-trips a note as a record born dirty and syncable', async () => {
		await store.setExerciseNote('bench-press', 'Seat 4', 100);

		expect(await store.exerciseNote('bench-press')).toBe('Seat 4');

		expect(await store.dirtyRecords()).toEqual([
			wire('note:bench-press', 100, { text: 'Seat 4' }, 'preference')
		]);
	});

	it('rewriting overwrites in place: there is only ever one per exercise', async () => {
		await store.setExerciseNote('bench-press', 'Seat 4', 100);
		await store.setExerciseNote('bench-press', 'Seat 5', 200);

		expect(await store.exerciseNote('bench-press')).toBe('Seat 5');
		expect(await store.dirtyRecords()).toHaveLength(1);
	});

	// The whole reason a note is its own record and not one map of them all:
	// last-write-wins is per record, so two exercises edited on two devices do
	// not clobber each other.
	it('keeps one exercise clear of another', async () => {
		await store.setExerciseNote('bench-press', 'Seat 4', 100);
		await store.setExerciseNote('cable-fly', 'Pin 3', 200);

		expect(await store.exerciseNote('bench-press')).toBe('Seat 4');
		expect(await store.exerciseNote('cable-fly')).toBe('Pin 3');
	});

	// Notes and rest overrides share the `preference` kind and its index, so
	// each scan has to walk past the other's records untouched.
	it('does not read as a rest override, nor a rest override as a note', async () => {
		await store.setExerciseNote('bench-press', 'Seat 4', 100);
		await store.setRestOverride('bench-press', 150, 200);

		const settings = await store.restSettings();

		expect(settings.overrides).toEqual({ 'bench-press': 150 });
		expect(await store.exerciseNote('bench-press')).toBe('Seat 4');
	});

	it('clearing tombstones rather than storing an empty note', async () => {
		await store.setExerciseNote('bench-press', 'Seat 4', 100);
		await store.clearExerciseNote('bench-press', 300);

		expect(await store.exerciseNote('bench-press')).toBe('');

		const dirty = await store.dirtyRecords();
		expect(dirty).toHaveLength(1);
		expect(dirty[0]).toMatchObject({ id: 'note:bench-press', deletedAt: 300, updatedAt: 300 });
	});

	it('reads a tombstoned note as no note', async () => {
		await store.applyRemote([wire('note:bench-press', 50, { text: 'Seat 4' }, 'preference', 60)]);

		expect(await store.exerciseNote('bench-press')).toBe('');
	});

	it('falls back rather than rendering a payload it cannot read as text', async () => {
		await store.applyRemote([wire('note:bench-press', 50, { text: 4 }, 'preference')]);

		expect(await store.exerciseNote('bench-press')).toBe('');
	});
});

describe('history derivation', () => {
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
			{ weight: 80, reps: 8, rpe: null },
			{ weight: 77.5, reps: 8, rpe: null }
		]);
	});

	it('keeps the earlier session when a later workout completed nothing', async () => {
		await store.finishWorkout(workout('w1', 100, 'bench-press', [{ weight: 80, reps: 8 }]), 150);
		await store.finishWorkout(
			workout('w2', 200, 'bench-press', [{ weight: 85, reps: 5, completed: false }]),
			250
		);

		const history = await store.history();

		expect(history['bench-press']).toEqual([{ weight: 80, reps: 8, rpe: null }]);
	});

	it('reads a record written before ratings existed as unrated', async () => {
		const legacy = workout('legacy', 100, 'bench-press', [{ weight: 80, reps: 8 }]);
		const legacySet: Partial<WorkoutSet> = legacy.entries[0].exercises[0].sets[0];

		delete legacySet.rpe;

		await store.applyRemote([wire('legacy', 100, finished(legacy, 150))]);

		const history = await store.history();

		expect(history['bench-press']).toEqual([{ weight: 80, reps: 8, rpe: null }]);
	});
});

describe('last performed', () => {
	it('dates the last session by its start, not its finish', async () => {
		await store.finishWorkout(workout('w1', 100, 'bench-press', [{ weight: 80, reps: 8 }]), 150);

		expect(await store.lastPerformed()).toEqual({
			'bench-press': {
				date: 100,
				workoutId: 'w1',
				position: 1,
				sets: [{ weight: 80, reps: 8, rpe: null }]
			}
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
			sets: [{ weight: 85, reps: 5, rpe: null }]
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

		const history = await store.history();

		expect(history['bench-press']).toEqual([{ weight: 80, reps: 8, rpe: null }]);
		expect(hintsOf(await store.lastPerformed())).toEqual(history);
	});
});

describe('past sessions', () => {
	it('returns one exercise, oldest first, dated by session start', async () => {
		await store.finishWorkout(workout('w2', 200, 'bench-press', [{ weight: 82.5, reps: 6 }]), 250);
		await store.finishWorkout(workout('w1', 100, 'bench-press', [{ weight: 80, reps: 8 }]), 150);
		await store.finishWorkout(workout('w3', 300, 'cable-fly', [{ weight: 20, reps: 12 }]), 350);

		const past = await store.pastSessions('bench-press');

		expect(past).toEqual([
			{ date: 100, workoutId: 'w1', position: 1, sets: [{ weight: 80, reps: 8, rpe: null }] },
			{ date: 200, workoutId: 'w2', position: 1, sets: [{ weight: 82.5, reps: 6, rpe: null }] }
		]);
	});

	it('counts the ordinal across every exercise the workout holds, performed or not', async () => {
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
			{ date: 100, workoutId: 'w1', position: 3, sets: [{ weight: 50, reps: 10, rpe: null }] }
		]);

		const projected = await store.lastPerformed();

		expect(projected['pec-deck']!.position).toBe(3);
	});
});

describe('frequent exercises', () => {
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
		await store.finishWorkout(session('w1', 100, ['cable-fly']), 150);
		await store.finishWorkout(session('w2', 200, ['pec-deck']), 250);

		expect(frequentFrom(await store.listWorkouts())).toEqual(['pec-deck', 'cable-fly']);
	});

	it('counts an exercise performed twice in one session once', async () => {
		await store.finishWorkout(session('w1', 100, ['bench-press', 'bench-press']), 150);
		await store.finishWorkout(session('w2', 200, ['cable-fly']), 250);

		expect(frequentFrom(await store.listWorkouts())).toEqual(['cable-fly', 'bench-press']);
	});

	it('ignores an exercise nothing was completed on', async () => {
		await store.finishWorkout(session('w1', 100, ['bench-press'], false), 150);
		await store.finishWorkout(session('w2', 200, ['cable-fly']), 250);

		expect(frequentFrom(await store.listWorkouts())).toEqual(['cable-fly']);
	});

	it('looks ten sessions back and no further', async () => {
		await store.finishWorkout(session('w0', 100, ['cable-fly']), 150);

		for (let i = 1; i <= 10; i += 1) {
			await store.finishWorkout(session(`w${i}`, 100 + i * 100, ['bench-press']), 150 + i * 100);
		}

		expect(frequentFrom(await store.listWorkouts())).toEqual(['bench-press']);
	});

	it('shelves nothing on a fresh install', async () => {
		expect(frequentFrom(await store.listWorkouts())).toEqual([]);
	});

	it('caps the shelf', async () => {
		await store.finishWorkout(session('w1', 100, ['a', 'b', 'c']), 150);

		expect(frequentFrom(await store.listWorkouts(), 2)).toEqual(['a', 'b']);
	});
});

describe('the active session snapshot', () => {
	it('round-trips and clears', async () => {
		const snapshot = {
			workout: workout('w1', 100, 'bench-press', [{ weight: 80, reps: 8, completed: false }]),
			activeSetId: 'w1-set-0',
			rest: null,
			muted: false
		};

		expect(await store.loadSnapshot()).toBeNull();

		await store.saveSnapshot(snapshot);
		expect(await store.loadSnapshot()).toEqual(snapshot);

		await store.clearSnapshot();
		expect(await store.loadSnapshot()).toBeNull();
	});
});

describe('sync bookkeeping', () => {
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
		expect(await store.owner()).toBeNull();

		await store.claimOwner('user-a');
		expect(await store.owner()).toBe('user-a');
	});
});

describe('changing hands', () => {
	beforeEach(async () => {
		await store.finishWorkout(workout('w1', 100, 'bench-press', [{ weight: 80, reps: 8 }]), 200);
		await store.acknowledge([{ id: 'w1', updatedAt: 200 }]);
		await store.setWatermark(42);
		await store.claimOwner('user-a');
	});

	it('adopt keeps the records, re-dirties them, and re-stamps the owner from zero', async () => {
		expect(await store.dirtyRecords()).toEqual([]);
		expect(await store.claimOwner('user-b')).toBe(false);

		await store.adopt('user-b');

		const dirty = await store.dirtyRecords();
		expect(dirty).toHaveLength(1);
		expect(dirty[0].id).toBe('w1');

		expect(await store.listWorkouts()).toHaveLength(1);
		expect(await store.owner()).toBe('user-b');
		expect(await store.watermark()).toBe(0);
		expect(await store.claimOwner('user-b')).toBe(true);
		expect(await store.claimOwner('user-a')).toBe(false);
	});

	it('wipe empties the device, snapshot included', async () => {
		await store.saveSnapshot({
			workout: workout('live', 900, 'squat', [{ weight: 100, reps: 5 }]),
			activeSetId: null,
			rest: null,
			muted: false
		});

		await store.wipe('user-b');

		expect(await store.listWorkouts()).toEqual([]);
		expect(await store.dirtyRecords()).toEqual([]);
		expect(await store.loadSnapshot()).toBeNull();
		expect(await store.watermark()).toBe(0);
		expect(await store.owner()).toBe('user-b');
	});

	it('disown keeps the records and leaves the store claimable by anyone', async () => {
		await store.disown();

		const dirty = await store.dirtyRecords();
		expect(dirty).toHaveLength(1);
		expect(dirty[0].id).toBe('w1');

		expect(await store.listWorkouts()).toHaveLength(1);
		expect(await store.owner()).toBeNull();
		expect(await store.watermark()).toBe(0);

		expect(await store.claimOwner('user-b')).toBe(true);
	});

	it('wipe with no owner leaves an empty store nobody has claimed', async () => {
		await store.wipe(null);

		expect(await store.listWorkouts()).toEqual([]);
		expect(await store.owner()).toBeNull();
		expect(await store.claimOwner('user-b')).toBe(true);
	});
});
