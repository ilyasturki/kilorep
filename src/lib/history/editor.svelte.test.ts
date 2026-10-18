import 'fake-indexeddb/auto';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { timeOf } from '$lib/domain/retime';
import type { WorkoutSet } from '$lib/domain/workout';
import { RecordEditor } from '$lib/history/editor.svelte';
import { openDatabase } from '$lib/store/db';
import type { FinishedWorkout } from '$lib/store/derive';
import { Store } from '$lib/store/store';

const MINUTE = 60_000;

const STARTED = Date.parse('2026-06-10T16:04:00Z');

let databases = 0;

async function freshStore(): Promise<Store> {
	databases += 1;

	return new Store(await openDatabase(`kilorep-editor-${databases}`));
}

function set(id: string, values: Partial<WorkoutSet> = {}): WorkoutSet {
	const logged: WorkoutSet = {
		id,
		type: 'normal',
		plannedReps: 8,
		weight: 80,
		reps: 8,
		rpe: null,
		completed: true
	};

	return Object.assign(logged, values);
}

function record(): FinishedWorkout {
	return {
		id: 'w1',
		templateId: null,
		startedAt: STARTED,
		finishedAt: STARTED + 70 * MINUTE,
		entries: [
			{
				id: 'e1',
				exercises: [
					{
						id: 'x1',
						exerciseId: 'bench-press',
						sets: [set('s1'), set('s2'), set('s3', { weight: null, reps: null, completed: false })]
					}
				]
			}
		]
	};
}

function setOf(editor: RecordEditor, id: string): WorkoutSet {
	const found = editor.draft.entries[0].exercises[0].sets.find((candidate) => candidate.id === id);

	if (found === undefined) {
		throw new Error(`no set ${id}`);
	}

	return found;
}

async function stored(store: Store): Promise<FinishedWorkout> {
	const workout = await store.getWorkout('w1');

	if (workout === null) {
		throw new Error('w1 is not in the store');
	}

	return workout;
}

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('RecordEditor figures', () => {
	test('a corrected number on a logged set keeps it logged', () => {
		const editor = new RecordEditor(record());

		editor.figure('s1', 'weight', 82.5);

		expect(setOf(editor, 's1')).toMatchObject({ weight: 82.5, reps: 8, completed: true });
		expect(editor.dirty).toBe(true);
	});

	test('clearing a number takes the set out of the count', () => {
		const editor = new RecordEditor(record());

		editor.figure('s2', 'reps', null);

		expect(setOf(editor, 's2')).toMatchObject({ weight: 80, reps: null, completed: false });
	});

	test('both numbers typed into an unlogged set log it; one alone does not', () => {
		const editor = new RecordEditor(record());

		editor.figure('s3', 'weight', 75);

		expect(setOf(editor, 's3')).toMatchObject({ weight: 75, reps: null, completed: false });

		editor.figure('s3', 'reps', 6);

		expect(setOf(editor, 's3')).toMatchObject({ weight: 75, reps: 6, completed: true });
	});

	test('zero reps is not a set', () => {
		const editor = new RecordEditor(record());

		editor.figure('s1', 'reps', 0);

		expect(setOf(editor, 's1')).toMatchObject({ reps: 0, completed: false });
	});

	test('the number already there leaves the draft clean', () => {
		const editor = new RecordEditor(record());

		editor.figure('s1', 'weight', 80);
		editor.figure('s1', 'reps', 8);

		expect(editor.dirty).toBe(false);
	});

	test('weights settle to the hundredth and reps to the whole', () => {
		const editor = new RecordEditor(record());

		editor.figure('s1', 'weight', 82.456);
		editor.figure('s1', 'reps', 7.6);

		expect(setOf(editor, 's1')).toMatchObject({ weight: 82.46, reps: 8 });
	});

	test('log and unlog move only the count', () => {
		const editor = new RecordEditor(record());

		editor.unlog('s1');

		expect(setOf(editor, 's1')).toMatchObject({ weight: 80, reps: 8, completed: false });

		editor.log('s1');
		editor.log('s3');

		expect(setOf(editor, 's1').completed).toBe(true);
		// Nothing to count in a set that holds no numbers.
		expect(setOf(editor, 's3').completed).toBe(false);
	});
});

describe('RecordEditor dates', () => {
	test('a new day keeps the wall time and the length', () => {
		vi.stubEnv('TZ', 'Europe/Paris');

		const editor = new RecordEditor(record());
		const before = timeOf(editor.draft.startedAt);

		editor.moveTo('2026-06-03');

		expect(timeOf(editor.draft.startedAt)).toBe(before);
		expect(new Date(editor.draft.startedAt).getDate()).toBe(3);
		expect(editor.draft.finishedAt - editor.draft.startedAt).toBe(70 * MINUTE);
		expect(editor.dirty).toBe(true);
	});
});

describe('RecordEditor drafts', () => {
	test('edits stay in the draft until it is saved', () => {
		const original = record();
		const kept = structuredClone(original);
		const editor = new RecordEditor(original);

		editor.figure('s1', 'weight', 100);
		editor.session.addSet('x1');
		editor.session.removeSet('s2');
		editor.moveTo('2026-06-01');

		expect(original).toEqual(kept);
	});

	test('a structural edit is a change like any other', () => {
		const editor = new RecordEditor(record());

		editor.session.addSet('x1');

		expect(editor.dirty).toBe(true);
		expect(editor.draft.entries[0].exercises[0].sets).toHaveLength(4);
	});
});

describe('RecordEditor.save', () => {
	test('many edits are one write', async () => {
		const store = await freshStore();

		await store.finishWorkout(record(), record().finishedAt);

		const editor = new RecordEditor(await stored(store));
		const update = vi.spyOn(store, 'updateWorkout');

		editor.figure('s1', 'weight', 85);
		editor.figure('s3', 'weight', 70);
		editor.figure('s3', 'reps', 5);
		editor.session.addSet('x1');
		editor.moveTo('2026-06-08');

		expect(await editor.save(store, 5000)).toBe(true);
		expect(update).toHaveBeenCalledTimes(1);

		const saved = await stored(store);

		expect(saved.startedAt).toBe(editor.draft.startedAt);
		expect(saved.entries[0].exercises[0].sets.map((s) => [s.weight, s.reps, s.completed])).toEqual([
			[85, 8, true],
			[80, 8, true],
			[70, 5, true],
			[null, null, false]
		]);

		const dirty = await store.dirtyRecords();

		expect(dirty).toHaveLength(1);
		expect(dirty[0]).toMatchObject({ id: 'w1', updatedAt: 5000 });
	});

	test('an untouched draft writes nothing', async () => {
		const store = await freshStore();

		await store.finishWorkout(record(), record().finishedAt);

		const editor = new RecordEditor(await stored(store));
		const update = vi.spyOn(store, 'updateWorkout');

		expect(await editor.save(store, 5000)).toBe(false);
		expect(update).not.toHaveBeenCalled();
	});

	test('what the editor does not know survives a save', async () => {
		const store = await freshStore();

		const written = record();
		const entry = written.entries[0];
		const exercise = entry.exercises[0];

		// Fields a later build (or another session's branch) puts on the record.
		Object.assign(entry, { label: 'kept on the entry' });
		Object.assign(exercise, {
			note: 'seat 4',
			plannedAs: 'incline-bench-press',
			optional: true,
			later: { nested: [1, 2] }
		});
		Object.assign(exercise.sets[0], { tempo: '3-1-1', later: { nested: true } });

		await store.finishWorkout(written, written.finishedAt);

		const editor = new RecordEditor(await stored(store));

		editor.figure('s1', 'reps', 9);
		editor.session.addSet('x1');
		editor.moveTo('2026-06-09');

		await editor.save(store, 5000);

		const saved = await stored(store);

		expect(saved.entries[0]).toMatchObject({ label: 'kept on the entry' });
		expect(saved.entries[0].exercises[0]).toMatchObject({
			note: 'seat 4',
			plannedAs: 'incline-bench-press',
			optional: true,
			later: { nested: [1, 2] }
		});
		expect(saved.entries[0].exercises[0].sets[0]).toMatchObject({
			reps: 9,
			tempo: '3-1-1',
			later: { nested: true }
		});
		expect(saved.entries[0].exercises[0].sets).toHaveLength(4);
	});
});
