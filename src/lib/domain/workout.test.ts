import { describe, expect, test } from 'vitest';

import { catalogById } from '$lib/catalog';
import { freshWorkout, history } from '$lib/domain/fixture';
import {
	addExercise,
	addExerciseTo,
	addSet,
	addWarmup,
	advanceFrom,
	canCommit,
	clearSet,
	commitSet,
	cursorFor,
	cursors,
	draftSet,
	firstUncompleted,
	hintFor,
	hintLabel,
	insertedSetCount,
	isEntryDraft,
	isWholeDraft,
	joinEntry,
	markSet,
	moveEntry,
	moveExercise,
	neverLogged,
	parseEntry,
	parseWhole,
	prefillFor,
	rampFor,
	rampLabel,
	rateSet,
	removeExercise,
	removeSet,
	repeatFrom,
	replaceExercise,
	setExerciseNote,
	setSetType,
	settle,
	splitEntry,
	supersetWith,
	tally,
	untouched
} from '$lib/domain/workout';
import type {
	History,
	Prefill,
	SetCursor,
	SwapMode,
	Workout,
	WorkoutExercise,
	WorkoutSet
} from '$lib/domain/workout';
import type { Exercise } from '$lib/domain/exercise';

// The real entries, so the grip axis a hint is keyed by is the one the app would read.
function metaOf(cursor: SetCursor): Exercise | undefined {
	return catalogById[cursor.exercise.exerciseId];
}

function idsOf(workout: Workout): string[] {
	return cursors(workout).map((c) => c.set.id);
}

function orderOf(workout: Workout): string[] {
	return workout.entries.flatMap((entry) => entry.exercises.map((e) => e.exerciseId));
}

function openSet(id: string, plannedReps: number | null = 10): WorkoutSet {
	return {
		id,
		type: 'normal',
		plannedReps,
		weight: null,
		reps: null,
		rpe: null,
		completed: false
	};
}

function superset(workout: Workout): Workout {
	workout.entries = [
		workout.entries[0],
		{
			id: 'superset',
			exercises: [
				{
					id: 'we-a',
					exerciseId: 'cable-fly',
					sets: [openSet('a-1'), openSet('a-2'), openSet('a-3')]
				},
				{ id: 'we-b', exerciseId: 'pec-deck', sets: [openSet('b-1'), openSet('b-2')] }
			]
		}
	];

	return workout;
}

const freshEntry = (): string => 'fresh';

function at(workout: Workout, setId: string): SetCursor {
	const cursor = cursorFor(workout, setId);

	if (cursor === null) {
		throw new Error(`no cursor for ${setId}`);
	}

	return cursor;
}

function idOf(cursor: SetCursor | null): string | null {
	return cursor === null ? null : cursor.set.id;
}

function prefillOf(workout: Workout, setId: string): Prefill {
	const cursor = at(workout, setId);

	return prefillFor(cursor, history);
}

function completeAll(workout: Workout): void {
	for (const cursor of cursors(workout)) {
		commitSet(workout, cursor.set.id, 100, 5);
	}
}

describe('cursors', () => {
	test('walks the tree in session order', () => {
		expect(idsOf(freshWorkout(0)).slice(0, 6)).toEqual([
			'bench-w',
			'bench-1',
			'bench-2',
			'bench-3',
			'bench-4',
			'incline-1'
		]);
	});

	test('a warmup takes no working index, so the sets under it do not shift', () => {
		const workout = freshWorkout(0);

		expect(at(workout, 'bench-w').workingIndex).toBe(-1);
		expect(at(workout, 'bench-1').workingIndex).toBe(0);
		expect(at(workout, 'bench-4').workingIndex).toBe(3);
	});
});

describe('hintFor', () => {
	test('reads last time by working index', () => {
		expect(hintFor(history, 'bench-press', 0)).toEqual({ weight: 80, reps: 8, rpe: null });
		expect(hintFor(history, 'bench-press', 3)).toEqual({ weight: 77.5, reps: 7, rpe: null });
	});

	test('an exercise never performed has no hint', () => {
		expect(hintFor(history, 'pec-deck', 0)).toBeNull();
	});

	test('a warmup has no hint, and asking does not read index -1 off the end', () => {
		expect(hintFor(history, 'bench-press', -1)).toBeNull();
	});

	test('a set beyond last time has no hint', () => {
		expect(hintFor(history, 'cable-fly', 5)).toBeNull();
	});
});

describe('prefillFor', () => {
	test('weight recalls, reps prefer the plan over the recall', () => {
		expect(prefillOf(freshWorkout(0), 'bench-4')).toEqual({ weight: 77.5, reps: 8 });
	});

	test('an open target falls through to last time', () => {
		expect(prefillOf(freshWorkout(0), 'incline-1')).toEqual({ weight: 30, reps: 10 });
	});

	test('no history leaves weight blank and keeps the planned reps', () => {
		expect(prefillOf(freshWorkout(0), 'pecdeck-1')).toEqual({ weight: null, reps: 10 });
	});

	test('what the set already holds outranks both', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'bench-1', 82.5, 6);

		expect(prefillOf(workout, 'bench-1')).toEqual({ weight: 82.5, reps: 6 });
	});

	test('a set past the end of history carries the one above it', () => {
		const workout = freshWorkout(0);
		const added = addSet(workout, 'we-bench', 'bench-5');
		commitSet(workout, 'bench-4', 75, 8);

		expect(added).not.toBeNull();
		expect(prefillOf(workout, 'bench-5')).toEqual({ weight: 75, reps: 8 });
	});

	test('an exercise with no history at all carries too', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'pecdeck-1', 45, 10);

		expect(prefillOf(workout, 'pecdeck-2')).toEqual({ weight: 45, reps: 10 });
	});

	test('the set above outranks history at this index', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'fly-1', 25, 12);

		expect(prefillOf(workout, 'fly-2')).toEqual({ weight: 25, reps: 12 });
	});

	test('the carry owns the reps when it disagrees with the plan', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'bench-1', 82.5, 6);

		expect(prefillOf(workout, 'bench-2')).toEqual({ weight: 82.5, reps: 6 });
	});

	test('the plan still fills a set no set of this exercise has been logged above', () => {
		const workout = freshWorkout(0);

		expect(prefillOf(workout, 'bench-1')).toEqual({ weight: 80, reps: 8 });
	});

	test('an open target carries both numbers over the recall', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'incline-1', 32.5, 8);

		expect(prefillOf(workout, 'incline-2')).toEqual({ weight: 32.5, reps: 8 });
	});

	test('the carry skips a warmup and any set holding nothing', () => {
		const workout = freshWorkout(0);
		expect(prefillOf(workout, 'pecdeck-3')).toEqual({ weight: null, reps: 10 });

		const bench = freshWorkout(0);
		addSet(bench, 'we-bench', 'bench-5');

		expect(prefillOf(bench, 'bench-5')).toEqual({ weight: null, reps: null });
	});

	// Asking is not answering: the offer was read off a set nobody had lifted yet, and the set
	// held on to it. Twelve was the plan's target, ten was the set actually performed above it.
	test('a set only looked at is not a set that holds numbers', () => {
		const workout = freshWorkout(0);
		expect(prefillOf(workout, 'fly-2')).toEqual({ weight: 20, reps: 12 });

		commitSet(workout, 'fly-1', 20, 10);

		expect(prefillOf(workout, 'fly-2')).toEqual({ weight: 20, reps: 10 });
	});

	test('what the lifter typed outranks the carry, and the carry never overwrites it', () => {
		const workout = freshWorkout(0);
		draftSet(workout, 'fly-2', { weight: 17.5, reps: 15 });
		commitSet(workout, 'fly-1', 20, 10);

		expect(prefillOf(workout, 'fly-2')).toEqual({ weight: 17.5, reps: 15 });
	});

	test('a blank the lifter made is a blank, and nothing fills it back in', () => {
		const workout = freshWorkout(0);
		clearSet(workout, 'fly-2');
		commitSet(workout, 'fly-1', 20, 10);

		expect(prefillOf(workout, 'fly-2')).toEqual({ weight: null, reps: null });
	});

	test('one field cleared keeps the other, and neither is offered again', () => {
		const workout = freshWorkout(0);
		draftSet(workout, 'bench-1', { weight: 80, reps: null });

		expect(prefillOf(workout, 'bench-1')).toEqual({ weight: 80, reps: null });
	});
});

describe('clearSet', () => {
	test('takes both numbers back and unmakes the claim', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'bench-1', 82.5, 6);

		expect(clearSet(workout, 'bench-1')).toBe(true);
		expect(at(workout, 'bench-1').set).toMatchObject({
			weight: null,
			reps: null,
			completed: false
		});
	});

	test('a set nobody can find is not cleared', () => {
		expect(clearSet(freshWorkout(0), 'nope')).toBe(false);
	});

	test('the set above it carries on carrying', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'fly-1', 20, 10);
		commitSet(workout, 'fly-2', 20, 9);
		clearSet(workout, 'fly-2');

		expect(prefillOf(workout, 'fly-3')).toEqual({ weight: 20, reps: 10 });
	});
});

describe('canCommit', () => {
	test('zero is a real weight', () => {
		expect(canCommit(0, 8)).toBe(true);
	});

	test('nothing recalled and nothing entered is not a claim', () => {
		expect(canCommit(null, 10)).toBe(false);
		expect(canCommit(60, null)).toBe(false);
	});

	test('a set of zero reps is not a set', () => {
		expect(canCommit(60, 0)).toBe(false);
	});
});

describe('commitSet', () => {
	test('writes exactly what it is given', () => {
		const workout = freshWorkout(0);

		expect(commitSet(workout, 'bench-1', 82.5, 6)).toBe(true);
		expect(at(workout, 'bench-1').set).toMatchObject({
			weight: 82.5,
			reps: 6,
			completed: true
		});
	});

	test('an unknown set is refused rather than silently ignored', () => {
		expect(commitSet(freshWorkout(0), 'nope', 60, 8)).toBe(false);
	});
});

describe('draftSet', () => {
	test('writes the values and leaves the claim unmade', () => {
		const workout = freshWorkout(0);

		expect(draftSet(workout, 'bench-1', { weight: 80, reps: 8 })).toBe(true);
		expect(at(workout, 'bench-1').set).toMatchObject({
			weight: 80,
			reps: 8,
			completed: false
		});
	});

	test('null is a value, not a slot to skip', () => {
		const workout = freshWorkout(0);
		draftSet(workout, 'bench-1', { weight: 80, reps: 8 });

		expect(draftSet(workout, 'bench-1', { weight: null, reps: null })).toBe(true);
		expect(at(workout, 'bench-1').set).toMatchObject({ weight: null, reps: null });
	});

	test('seeding is idempotent, and cannot rewrite a logged set', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'bench-1', 82.5, 6);

		draftSet(workout, 'bench-1', prefillOf(workout, 'bench-1'));

		expect(at(workout, 'bench-1').set).toMatchObject({
			weight: 82.5,
			reps: 6,
			completed: true
		});
	});

	test('a set that loses a value stops claiming it happened', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'bench-1', 82.5, 6);

		draftSet(workout, 'bench-1', { weight: null, reps: 6 });

		expect(at(workout, 'bench-1').set).toMatchObject({
			weight: null,
			reps: 6,
			completed: false
		});
	});

	test('a claim survives an edit that leaves both numbers standing', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'bench-1', 82.5, 6);

		draftSet(workout, 'bench-1', { weight: 85, reps: 6 });

		expect(at(workout, 'bench-1').set).toMatchObject({ weight: 85, completed: true });
	});

	test('an unknown set is refused rather than silently ignored', () => {
		expect(draftSet(freshWorkout(0), 'nope', { weight: 60, reps: 8 })).toBe(false);
	});
});

describe('rateSet', () => {
	test('writes the rating without touching anything else on the set', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'bench-1', 82.5, 7);

		expect(rateSet(workout, 'bench-1', 8)).toBe(true);

		const set = at(workout, 'bench-1').set;

		expect(set.rpe).toBe(8);
		expect(set.completed).toBe(true);
		expect(set.weight).toBe(82.5);
		expect(set.reps).toBe(7);
	});

	test('rates a set nothing has been logged on, and the check stays inert', () => {
		const workout = freshWorkout(0);
		const set = at(workout, 'bench-1').set;
		draftSet(workout, 'bench-1', { weight: null, reps: null });

		rateSet(workout, 'bench-1', 9);

		expect(set.rpe).toBe(9);
		expect(set.completed).toBe(false);
		expect(canCommit(set.weight, set.reps)).toBe(false);
	});

	test('null takes the rating back off', () => {
		const workout = freshWorkout(0);
		rateSet(workout, 'bench-1', 8);
		rateSet(workout, 'bench-1', null);

		expect(at(workout, 'bench-1').set.rpe).toBeNull();
	});

	test('settles on the way in, wherever the number came from', () => {
		const workout = freshWorkout(0);

		rateSet(workout, 'bench-1', 8.3);
		expect(at(workout, 'bench-1').set.rpe).toBe(8.5);

		rateSet(workout, 'bench-1', 40);
		expect(at(workout, 'bench-1').set.rpe).toBe(10);
	});

	test('a NaN is unrated, not the bottom of the scale', () => {
		const workout = freshWorkout(0);

		rateSet(workout, 'bench-1', Number.NaN);

		expect(at(workout, 'bench-1').set.rpe).toBeNull();
	});

	test('an unknown set is refused rather than silently ignored', () => {
		expect(rateSet(freshWorkout(0), 'nope', 8)).toBe(false);
	});
});

describe('markSet', () => {
	test('takes the claim back without touching the numbers', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'bench-1', 82.5, 6);

		expect(markSet(workout, 'bench-1', false)).toBe(true);
		expect(at(workout, 'bench-1').set).toMatchObject({
			weight: 82.5,
			reps: 6,
			completed: false
		});
	});

	test('claims a set that already holds both numbers', () => {
		const workout = freshWorkout(0);
		draftSet(workout, 'bench-1', { weight: 80, reps: 8 });

		expect(markSet(workout, 'bench-1', true)).toBe(true);
		expect(at(workout, 'bench-1').set.completed).toBe(true);
	});

	test('refuses to claim a set with nothing in it', () => {
		const workout = freshWorkout(0);
		draftSet(workout, 'bench-1', { weight: null, reps: null });

		expect(markSet(workout, 'bench-1', true)).toBe(false);
		expect(at(workout, 'bench-1').set.completed).toBe(false);
	});

	test('refuses to claim a set with no reps, and one with no weight', () => {
		const workout = freshWorkout(0);

		draftSet(workout, 'bench-1', { weight: 80, reps: null });
		expect(markSet(workout, 'bench-1', true)).toBe(false);

		draftSet(workout, 'bench-1', { weight: null, reps: 8 });
		expect(markSet(workout, 'bench-1', true)).toBe(false);
	});

	test('clearing a blank set is allowed', () => {
		const workout = freshWorkout(0);
		draftSet(workout, 'bench-1', { weight: null, reps: null });

		expect(markSet(workout, 'bench-1', false)).toBe(true);
	});

	test('an unknown set is refused rather than silently ignored', () => {
		expect(markSet(freshWorkout(0), 'nope', false)).toBe(false);
	});
});

describe('addSet', () => {
	test('appends an empty working set, planning nothing', () => {
		const workout = freshWorkout(0);
		const set = addSet(workout, 'we-bench', 'bench-5');

		expect(set).toEqual(openSet('bench-5', null));
		expect(idsOf(workout).slice(0, 7)).toEqual([
			'bench-w',
			'bench-1',
			'bench-2',
			'bench-3',
			'bench-4',
			'bench-5',
			'incline-1'
		]);
	});

	test('the added set has no hint and cannot be committed untouched', () => {
		const workout = freshWorkout(0);
		addSet(workout, 'we-bench', 'bench-5');

		const cursor = cursorFor(workout, 'bench-5')!;
		const prefill = prefillFor(cursor, history);

		expect(cursor.workingIndex).toBe(4);
		expect(prefill).toEqual({ weight: null, reps: null });
		expect(canCommit(prefill.weight, prefill.reps)).toBe(false);
	});

	test('an unknown exercise is refused rather than silently ignored', () => {
		expect(addSet(freshWorkout(0), 'we-nope', 'x-1')).toBeNull();
	});
});

describe('addExercise', () => {
	const ids = { entry: 'entry-5', exercise: 'we-row', sets: ['row-1', 'row-2', 'row-3'] };

	test('appends a new entry at the end of the session, sets blank', () => {
		const workout = freshWorkout(0);
		const entry = addExercise(workout, 'barbell-row', ids);

		expect(workout.entries.at(-1)).toBe(entry);
		expect(idsOf(workout).slice(-3)).toEqual(['row-1', 'row-2', 'row-3']);

		expect(entry!.exercises[0].sets[0]).toEqual(openSet('row-1', null));
	});

	test('an inserted exercise with history opens on last time, via the ordinary hint path', () => {
		const workout = freshWorkout(0);
		addExercise(workout, 'cable-fly', { entry: 'entry-5', exercise: 'we-fly2', sets: ['fly2-1'] });

		const fly = at(workout, 'fly2-1');
		const prefill = prefillFor(fly, history);

		expect(prefill).toEqual({ weight: 20, reps: 12 });
	});

	test('zero sets is refused: an exercise with no sets is not an exercise', () => {
		const workout = freshWorkout(0);

		expect(
			addExercise(workout, 'barbell-row', { entry: 'entry-5', exercise: 'we-row', sets: [] })
		).toBeNull();
		expect(workout.entries).toHaveLength(4);
	});

	test('lands directly behind the entry it was asked from', () => {
		const workout = freshWorkout(0);

		addExercise(workout, 'barbell-row', ids, 'entry-2');

		expect(orderOf(workout)).toEqual([
			'bench-press',
			'incline-dumbbell-press',
			'barbell-row',
			'cable-fly',
			'pec-deck'
		]);

		expect(idsOf(workout).slice(8, 11)).toEqual(['row-1', 'row-2', 'row-3']);
	});

	test('behind the last entry is the end, with nothing special about it', () => {
		const workout = freshWorkout(0);

		addExercise(workout, 'barbell-row', ids, 'entry-4');

		expect(workout.entries.at(-1)!.id).toBe('entry-5');
	});

	test('an unknown anchor falls to the end rather than refusing the insert', () => {
		const workout = freshWorkout(0);
		const entry = addExercise(workout, 'barbell-row', ids, 'entry-nope');

		expect(entry).not.toBeNull();
		expect(workout.entries.at(-1)).toBe(entry);
	});
});

describe('insertedSetCount', () => {
	test('as many sets as last time, so the hints line up under them', () => {
		expect(insertedSetCount(history, 'bench-press')).toBe(4);
		expect(insertedSetCount(history, 'cable-fly')).toBe(3);
	});

	test('three when nothing recalls the exercise', () => {
		expect(insertedSetCount(history, 'pec-deck')).toBe(3);
	});

	test('last time’s count, not the deepest an older session reached', () => {
		const deeper = {
			'cable-fly': [
				{ weight: 15, reps: 12, rpe: null },
				{ weight: 15, reps: 12, rpe: null },
				{ weight: 12.5, reps: 12, rpe: null, earlier: true as const }
			]
		};

		expect(insertedSetCount(deeper, 'cable-fly')).toBe(2);
	});
});

describe('removeSet', () => {
	test('takes the set out of the session, logged or not', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'bench-1', 80, 8);

		expect(removeSet(workout, 'bench-1')).toBe(true);
		expect(idsOf(workout)).not.toContain('bench-1');
	});

	test('the sets below it move up, hints included', () => {
		const workout = freshWorkout(0);
		removeSet(workout, 'bench-1');

		const cursor = cursorFor(workout, 'bench-2')!;

		expect(cursor.workingIndex).toBe(0);
		expect(hintLabel(history, cursor, metaOf(cursor))).toBe('80 × 8');
	});

	test('the last set of an exercise stays: that would be removing the exercise', () => {
		const workout = freshWorkout(0);

		expect(removeSet(workout, 'pecdeck-1')).toBe(true);
		expect(removeSet(workout, 'pecdeck-2')).toBe(true);
		expect(removeSet(workout, 'pecdeck-3')).toBe(false);
		expect(idsOf(workout)).toContain('pecdeck-3');
	});

	test('an unknown set is refused rather than silently ignored', () => {
		expect(removeSet(freshWorkout(0), 'nope')).toBe(false);
	});
});

let minted = 0;

function swap(
	workout: Workout,
	exerciseId: string,
	catalogId: string,
	mode: SwapMode = 'delete',
	grip?: string
): WorkoutExercise | null {
	return replaceExercise(workout, exerciseId, catalogId, mode, () => `m-${++minted}`, grip);
}

function swapped(...args: Parameters<typeof swap>): WorkoutExercise {
	const exercise = swap(...args);

	if (exercise === null) {
		throw new Error('the swap was refused');
	}

	return exercise;
}

describe('replaceExercise', () => {
	test('keeps the slot and the leg, and changes what is performed in it', () => {
		const workout = freshWorkout(0);
		const exercise = swapped(workout, 'we-incline', 'barbell-row');

		expect(workout.entries[1].exercises[0]).toBe(exercise);
		expect(exercise.id).toBe('we-incline');
		expect(workout.entries[1].id).toBe('entry-2');
		expect(orderOf(workout)).toEqual(['bench-press', 'barbell-row', 'cable-fly', 'pec-deck']);
	});

	test('the plan comes across: targets, set types and rest, on the same set ids', () => {
		const workout = freshWorkout(0);
		workout.entries[0].exercises[0].restSeconds = 150;

		const exercise = swapped(workout, 'we-bench', 'dumbbell-bench-press');

		expect(exercise.restSeconds).toBe(150);
		expect(exercise.sets.map((s) => s.id)).toEqual([
			'bench-w',
			'bench-1',
			'bench-2',
			'bench-3',
			'bench-4'
		]);
		expect(exercise.sets.map((s) => s.type)).toEqual([
			'warmup',
			'normal',
			'normal',
			'normal',
			'normal'
		]);
		expect(exercise.sets.map((s) => s.plannedReps)).toEqual([null, 8, 8, 8, 8]);
	});

	test('numbers typed on a set still to do were meant for the other lift', () => {
		const workout = freshWorkout(0);
		draftSet(workout, 'incline-1', { weight: 30, reps: 10 });

		swap(workout, 'we-incline', 'barbell-row', 'move');

		expect(at(workout, 'incline-1').set).toEqual(openSet('incline-1', null));
	});

	test('move: logged sets keep their numbers on the new exercise', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'bench-1', 80, 8);
		rateSet(workout, 'bench-1', 8);

		const exercise = swapped(workout, 'we-bench', 'dumbbell-bench-press', 'move');

		expect(exercise.sets.filter((s) => s.completed).map((s) => [s.id, s.weight, s.reps])).toEqual([
			['bench-w', 40, 10],
			['bench-1', 80, 8]
		]);
		expect(at(workout, 'bench-1').set.rpe).toBe(8);
		expect(at(workout, 'bench-2').set).toEqual(openSet('bench-2', 8));
	});

	test('keep: the logged sets stay, the rest start the new exercise right behind them', () => {
		const workout = freshWorkout(0);
		workout.entries[0].exercises[0].restSeconds = 150;
		commitSet(workout, 'bench-1', 80, 8);

		const exercise = swapped(workout, 'we-bench', 'dumbbell-bench-press', 'keep');

		expect(orderOf(workout)).toEqual([
			'bench-press',
			'dumbbell-bench-press',
			'incline-dumbbell-press',
			'cable-fly',
			'pec-deck'
		]);
		expect(workout.entries[0].exercises[0].sets.map((s) => s.id)).toEqual(['bench-w', 'bench-1']);
		expect(workout.entries[1].exercises[0]).toBe(exercise);
		expect(exercise.sets.map((s) => s.id)).toEqual(['bench-2', 'bench-3', 'bench-4']);
		expect(exercise.sets.map((s) => s.plannedReps)).toEqual([8, 8, 8]);
		expect(exercise.restSeconds).toBe(150);
		expect(exercise.plannedAs).toBe('bench-press');
		expect(workout.entries[0].exercises[0].plannedAs).toBeUndefined();
	});

	test('keep with every set logged starts the new exercise on the same shape, fresh', () => {
		const workout = freshWorkout(0);
		completeAll(workout);

		const exercise = swapped(workout, 'we-incline', 'barbell-row', 'keep');

		expect(workout.entries[1].exercises[0].sets.every((s) => s.completed)).toBe(true);
		expect(exercise.sets).toHaveLength(3);
		expect(exercise.sets.every((s) => !s.completed && s.weight === null)).toBe(true);
		expect(exercise.sets.map((s) => s.id)).not.toContain('incline-1');
	});

	test('delete: what was logged is gone, the plan is not', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'bench-1', 80, 8);

		const exercise = swapped(workout, 'we-bench', 'dumbbell-bench-press', 'delete');

		expect(exercise.sets).toHaveLength(5);
		expect(exercise.sets.some((s) => s.completed || s.weight !== null)).toBe(false);
		expect(orderOf(workout)[0]).toBe('dumbbell-bench-press');
	});

	test('with nothing logged, keep and move are the same swap as delete', () => {
		const shapes = (['move', 'keep', 'delete'] as const).map((mode) => {
			const workout = freshWorkout(0);

			swap(workout, 'we-incline', 'barbell-row', mode);

			return workout;
		});

		expect(shapes[0]).toEqual(shapes[2]);
		expect(shapes[1]).toEqual(shapes[2]);
	});

	test('the leg remembers what was planned, through a second swap and back', () => {
		const workout = freshWorkout(0);

		swap(workout, 'we-incline', 'barbell-row');
		expect(workout.entries[1].exercises[0].plannedAs).toBe('incline-dumbbell-press');

		swap(workout, 'we-incline', 'dumbbell-row');
		expect(workout.entries[1].exercises[0].plannedAs).toBe('incline-dumbbell-press');

		swap(workout, 'we-incline', 'incline-dumbbell-press');
		expect('plannedAs' in workout.entries[1].exercises[0]).toBe(false);
	});

	test('the grip is the new exercise’s, on the leg and every set, logged or not', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'incline-1', 30, 10);

		swap(workout, 'we-incline', 'pull-up', 'move', 'underhand');

		const leg = workout.entries[1].exercises[0];

		expect(leg.grip).toBe('underhand');
		expect(leg.sets.map((s) => s.grip)).toEqual(['underhand', 'underhand', 'underhand']);

		swap(workout, 'we-incline', 'barbell-row', 'move');

		expect('grip' in workout.entries[1].exercises[0]).toBe(false);
		expect(workout.entries[1].exercises[0].sets.some((s) => 'grip' in s)).toBe(false);
	});

	test('the same exercise, or an unknown leg, is refused and changes nothing', () => {
		const workout = freshWorkout(0);
		const before = structuredClone(workout);

		expect(swap(workout, 'we-incline', 'incline-dumbbell-press')).toBeNull();
		expect(swap(workout, 'nope', 'barbell-row')).toBeNull();
		expect(workout).toEqual(before);
	});

	test('the other leg of a superset is untouched', () => {
		const workout = superset(freshWorkout(0));
		commitSet(workout, 'b-1', 12, 15);

		swap(workout, 'we-a', 'barbell-row');

		expect(workout.entries[1].exercises.map((e) => e.exerciseId)).toEqual([
			'barbell-row',
			'pec-deck'
		]);
		expect(at(workout, 'b-1').set.completed).toBe(true);
	});
});

describe('removeExercise', () => {
	test('takes the exercise and every set under it, logged or not', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'incline-1', 30, 10);

		expect(removeExercise(workout, 'we-incline')).toBe(true);
		expect(orderOf(workout)).toEqual(['bench-press', 'cable-fly', 'pec-deck']);
		expect(idsOf(workout)).not.toContain('incline-1');
	});

	test('the last exercise goes too, leaving an empty session', () => {
		const workout = freshWorkout(0);

		for (const id of ['we-bench', 'we-incline', 'we-fly', 'we-pecdeck']) {
			expect(removeExercise(workout, id)).toBe(true);
		}

		expect(workout.entries).toEqual([]);
		expect(firstUncompleted(workout)).toBeNull();
	});

	test('an unknown exercise is refused rather than silently ignored', () => {
		expect(removeExercise(freshWorkout(0), 'nope')).toBe(false);
	});

	test('one leg of a superset leaves the other standing in the entry', () => {
		const workout = superset(freshWorkout(0));

		expect(removeExercise(workout, 'we-a')).toBe(true);
		expect(workout.entries[1].id).toBe('superset');
		expect(workout.entries[1].exercises.map((e) => e.id)).toEqual(['we-b']);
	});

	test('the entry goes when its last leg does', () => {
		const workout = superset(freshWorkout(0));

		removeExercise(workout, 'we-a');
		removeExercise(workout, 'we-b');

		expect(workout.entries.map((e) => e.id)).toEqual(['entry-1']);
	});
});

describe('joinEntry', () => {
	test('moves an exercise in, making the two a superset', () => {
		const workout = freshWorkout(0);

		expect(joinEntry(workout, 'entry-1', 'we-fly')).toBe(true);
		expect(workout.entries[0].exercises.map((e) => e.id)).toEqual(['we-bench', 'we-fly']);
		expect(workout.entries.map((e) => e.id)).toEqual(['entry-1', 'entry-2', 'entry-4']);
	});

	test('logged sets ride along', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'fly-1', 20, 12);

		joinEntry(workout, 'entry-1', 'we-fly');

		expect(at(workout, 'fly-1').set.completed).toBe(true);
		expect(at(workout, 'fly-1').entry.id).toBe('entry-1');
	});

	test('an exercise already in the entry is an honest no-op', () => {
		const workout = freshWorkout(0);

		expect(joinEntry(workout, 'entry-1', 'we-bench')).toBe(false);
		expect(workout.entries[0].exercises).toHaveLength(1);
	});

	test('an unknown entry and an unknown exercise are both refused', () => {
		expect(joinEntry(freshWorkout(0), 'nope', 'we-fly')).toBe(false);
		expect(joinEntry(freshWorkout(0), 'entry-1', 'nope')).toBe(false);
	});

	test('a third leg joins the same way', () => {
		const workout = freshWorkout(0);

		joinEntry(workout, 'entry-1', 'we-fly');
		joinEntry(workout, 'entry-1', 'we-pecdeck');

		expect(workout.entries[0].exercises.map((e) => e.id)).toEqual([
			'we-bench',
			'we-fly',
			'we-pecdeck'
		]);
	});
});

describe('supersetWith', () => {
	const ids = { exercise: 'we-new', sets: ['new-1', 'new-2'] };

	test('a movement already in the session moves in, logged sets and all', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'fly-1', 20, 12);

		expect(supersetWith(workout, 'entry-1', 'cable-fly', ids)).toBe(true);
		expect(workout.entries[0].exercises.map((e) => e.id)).toEqual(['we-bench', 'we-fly']);
		expect(workout.entries.map((e) => e.id)).toEqual(['entry-1', 'entry-2', 'entry-4']);
		expect(at(workout, 'fly-1').set.completed).toBe(true);
	});

	test('a movement not in the session arrives fresh, on the minted ids', () => {
		const workout = freshWorkout(0);

		expect(supersetWith(workout, 'entry-1', 'lateral-raise', ids)).toBe(true);
		expect(workout.entries[0].exercises.map((e) => e.id)).toEqual(['we-bench', 'we-new']);
		expect(workout.entries).toHaveLength(4);
		expect(at(workout, 'new-1').set.completed).toBe(false);
	});

	test('a movement already standing in this entry is added again', () => {
		const workout = freshWorkout(0);

		expect(supersetWith(workout, 'entry-1', 'bench-press', ids)).toBe(true);
		expect(workout.entries[0].exercises.map((e) => e.id)).toEqual(['we-bench', 'we-new']);
	});

	test('the first match wins when the session holds the exercise twice', () => {
		const workout = freshWorkout(0);
		addExercise(workout, 'cable-fly', {
			entry: 'entry-5',
			exercise: 'we-fly-again',
			sets: ['again-1']
		});

		supersetWith(workout, 'entry-1', 'cable-fly', ids);

		expect(workout.entries[0].exercises.map((e) => e.id)).toEqual(['we-bench', 'we-fly']);
	});

	test('an unknown entry is refused, and nothing is added anywhere', () => {
		const workout = freshWorkout(0);

		expect(supersetWith(workout, 'nope', 'lateral-raise', ids)).toBe(false);
		expect(cursors(workout).some((c) => c.set.id === 'new-1')).toBe(false);
	});
});

describe('splitEntry', () => {
	test('the legs become their own entries, in place and in order', () => {
		const workout = superset(freshWorkout(0));

		expect(splitEntry(workout, 'superset', freshEntry)).toBe(true);
		expect(workout.entries.map((e) => e.id)).toEqual(['entry-1', 'superset', 'fresh']);
		expect(orderOf(workout)).toEqual(['bench-press', 'cable-fly', 'pec-deck']);
	});

	test('nothing is lost — every set stays on the exercise holding it', () => {
		const workout = superset(freshWorkout(0));
		commitSet(workout, 'b-1', 12, 15);

		splitEntry(workout, 'superset', freshEntry);

		expect(at(workout, 'b-1').set.completed).toBe(true);
		expect(idsOf(workout)).toContain('a-1');
	});

	test('the first leg keeps the entry id', () => {
		const workout = superset(freshWorkout(0));

		splitEntry(workout, 'superset', freshEntry);

		expect(workout.entries[1].exercises[0].id).toBe('we-a');
	});

	test('a lone exercise was never a superset, and says so', () => {
		expect(splitEntry(freshWorkout(0), 'entry-1', freshEntry)).toBe(false);
	});

	test('an unknown entry is refused rather than silently ignored', () => {
		expect(splitEntry(freshWorkout(0), 'nope', freshEntry)).toBe(false);
	});
});

describe('moveExercise', () => {
	test('a leg trades places with the one beside it', () => {
		const workout = superset(freshWorkout(0));

		expect(moveExercise(workout, 'we-b', -1)).toBe(true);
		expect(orderOf(workout)).toEqual(['bench-press', 'pec-deck', 'cable-fly']);

		expect(moveExercise(workout, 'we-b', 1)).toBe(true);
		expect(orderOf(workout)).toEqual(['bench-press', 'cable-fly', 'pec-deck']);
	});

	test('the interleave follows, so the next set up is the new first leg', () => {
		const workout = superset(freshWorkout(0));

		expect(idsOf(workout).slice(-5)).toEqual(['a-1', 'b-1', 'a-2', 'b-2', 'a-3']);

		moveExercise(workout, 'we-b', -1);

		expect(idsOf(workout).slice(-5)).toEqual(['b-1', 'a-1', 'b-2', 'a-2', 'a-3']);
	});

	test('logged sets ride along, untouched', () => {
		const workout = superset(freshWorkout(0));
		commitSet(workout, 'b-1', 12, 15);

		moveExercise(workout, 'we-b', -1);

		expect(at(workout, 'b-1').set.completed).toBe(true);
		expect(at(workout, 'b-1').set.weight).toBe(12);
		expect(at(workout, 'b-1').entry.id).toBe('superset');
	});

	test('the ends of an entry refuse rather than wrapping', () => {
		const workout = superset(freshWorkout(0));

		expect(moveExercise(workout, 'we-a', -1)).toBe(false);
		expect(moveExercise(workout, 'we-b', 1)).toBe(false);
		expect(orderOf(workout)).toEqual(['bench-press', 'cable-fly', 'pec-deck']);
	});

	test('a lone exercise has no neighbour of its own to trade with', () => {
		const workout = superset(freshWorkout(0));

		expect(moveExercise(workout, 'we-bench', 1)).toBe(false);
		expect(moveExercise(workout, 'nope', -1)).toBe(false);
		expect(orderOf(workout)).toEqual(['bench-press', 'cable-fly', 'pec-deck']);
	});
});

describe('addExerciseTo', () => {
	const ids = { exercise: 'we-new', sets: ['new-1', 'new-2'] };

	test('lands as another leg of the entry, at the end', () => {
		const workout = freshWorkout(0);

		expect(addExerciseTo(workout, 'entry-1', 'barbell-row', ids)).not.toBeNull();
		expect(workout.entries[0].exercises.map((e) => e.id)).toEqual(['we-bench', 'we-new']);
		expect(workout.entries).toHaveLength(4);
	});

	test('the sets arrive blank, nothing prescribed', () => {
		const workout = freshWorkout(0);
		addExerciseTo(workout, 'entry-1', 'barbell-row', ids);

		expect(at(workout, 'new-1').set).toEqual(openSet('new-1', null));
	});

	test('zero sets and an unknown entry are both refused', () => {
		expect(
			addExerciseTo(freshWorkout(0), 'entry-1', 'barbell-row', { exercise: 'we-new', sets: [] })
		).toBeNull();
		expect(addExerciseTo(freshWorkout(0), 'nope', 'barbell-row', ids)).toBeNull();
	});
});

describe('advanceFrom', () => {
	test('the session opens on the first set still owed, skipping the logged warmup', () => {
		const workout = freshWorkout(0);

		expect(idOf(firstUncompleted(workout))).toBe('bench-1');
	});

	test('moves to the next set in the same exercise', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'bench-1', 80, 8);

		expect(idOf(advanceFrom(workout, 'bench-1'))).toBe('bench-2');
	});

	test('crosses the exercise boundary without being asked', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'bench-4', 80, 8);

		expect(idOf(advanceFrom(workout, 'bench-4'))).toBe('incline-1');
	});

	test('a jump ahead is not undone by the next commit', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'pecdeck-1', 45, 10);

		expect(idOf(advanceFrom(workout, 'pecdeck-1'))).toBe('pecdeck-2');
	});

	test('the tail exhausted, it does not come back for the gaps left behind', () => {
		const workout = freshWorkout(0);

		for (const id of ['pecdeck-1', 'pecdeck-2', 'pecdeck-3']) {
			commitSet(workout, id, 45, 10);
		}

		expect(advanceFrom(workout, 'pecdeck-3')).toBeNull();
		expect(idOf(firstUncompleted(workout))).toBe('bench-1');
	});

	test('a set skipped mid-session is stepped over, not doubled back to', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'bench-1', 80, 8);
		commitSet(workout, 'bench-3', 80, 7);

		expect(idOf(advanceFrom(workout, 'bench-3'))).toBe('bench-4');
	});

	test('null when every set is logged, which is the only finished signal', () => {
		const workout = freshWorkout(0);
		completeAll(workout);

		expect(advanceFrom(workout, 'pecdeck-3')).toBeNull();
		expect(firstUncompleted(workout)).toBeNull();
	});
});

function withOptional(index: number): Workout {
	const workout = freshWorkout(0);

	workout.entries[index].exercises[0].optional = true;

	return workout;
}

describe('an optional exercise', () => {
	test('the session never opens on one nobody has started', () => {
		const workout = freshWorkout(0);

		workout.entries[0].exercises[0].optional = true;
		workout.entries[0].exercises[0].sets[0].completed = false;

		expect(idOf(firstUncompleted(workout))).toBe('incline-1');
	});

	test('the cursor passes it by for the next required exercise', () => {
		const workout = withOptional(1);
		commitSet(workout, 'bench-4', 80, 8);

		expect(idOf(advanceFrom(workout, 'bench-4'))).toBe('fly-1');
	});

	test('tapped and logged, it is being done, and the cursor stays in it', () => {
		const workout = withOptional(1);
		commitSet(workout, 'incline-1', 30, 10);

		expect(untouched(workout.entries[1].exercises[0])).toBe(false);
		expect(idOf(advanceFrom(workout, 'incline-1'))).toBe('incline-2');
	});

	test('numbers typed into it are a start too', () => {
		const workout = withOptional(1);
		draftSet(workout, 'incline-1', { weight: 30, reps: null });

		expect(untouched(workout.entries[1].exercises[0])).toBe(false);
		expect(idOf(advanceFrom(workout, 'bench-4'))).toBe('incline-1');
	});

	test('its sets are still there to tap', () => {
		const workout = withOptional(1);

		expect(cursorFor(workout, 'incline-1')).not.toBeNull();
		expect(idsOf(workout)).toContain('incline-2');
	});

	test('a superset leg left alone is skipped round by round', () => {
		const workout = superset(freshWorkout(0));
		workout.entries[1].exercises[1].optional = true;
		commitSet(workout, 'a-1', 12, 15);

		expect(idOf(advanceFrom(workout, 'a-1'))).toBe('a-2');
	});

	test('only optional ones are ever untouched', () => {
		expect(untouched(freshWorkout(0).entries[1].exercises[0])).toBe(false);
	});

	test('left alone at the end, nothing is owed and the session reads as done', () => {
		const workout = withOptional(3);

		for (const cursor of cursors(workout)) {
			if (cursor.exercise.exerciseId !== 'pec-deck' && !cursor.set.completed) {
				commitSet(workout, cursor.set.id, 50, 8);
			}
		}

		expect(firstUncompleted(workout)).toBeNull();
		expect(advanceFrom(workout, 'fly-3')).toBeNull();
	});
});

describe('tally', () => {
	test('every unlogged set is owed in a session with nothing optional', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'bench-1', 80, 8);

		expect(tally(workout)).toEqual({ logged: 2, owed: 12 });
	});

	test('an optional exercise left alone owes nothing', () => {
		const workout = freshWorkout(0);
		workout.entries[3].exercises[0].optional = true;

		expect(tally(workout)).toEqual({ logged: 1, owed: 10 });
	});

	test('once started, its remaining sets are owed like any other', () => {
		const workout = freshWorkout(0);
		workout.entries[3].exercises[0].optional = true;
		commitSet(workout, 'pecdeck-1', 45, 10);

		expect(tally(workout)).toEqual({ logged: 2, owed: 12 });
	});
});

describe('performing a superset', () => {
	test('the legs interleave round by round', () => {
		const workout = superset(freshWorkout(0));

		expect(idsOf(workout).slice(5)).toEqual(['a-1', 'b-1', 'a-2', 'b-2', 'a-3']);
	});

	test('the advance crosses to the other leg', () => {
		const workout = superset(freshWorkout(0));
		commitSet(workout, 'a-1', 12, 15);

		expect(idOf(advanceFrom(workout, 'a-1'))).toBe('b-1');
	});

	test('a ragged leg finishes its tail alone', () => {
		const workout = superset(freshWorkout(0));
		commitSet(workout, 'b-2', 40, 12);

		expect(idOf(advanceFrom(workout, 'b-2'))).toBe('a-3');
	});

	test('warmups sit ahead of the rounds, in leg order', () => {
		const workout = superset(freshWorkout(0));

		workout.entries[1].exercises[1].sets.unshift({
			id: 'b-w',
			type: 'warmup',
			plannedReps: null,
			weight: 10,
			reps: 10,
			rpe: null,
			completed: false
		});

		expect(idsOf(workout).slice(5)).toEqual(['b-w', 'a-1', 'b-1', 'a-2', 'b-2', 'a-3']);
	});

	test('a lone exercise keeps its own array order', () => {
		const workout = freshWorkout(0);

		workout.entries[0].exercises[0].sets.splice(2, 0, {
			id: 'bench-w2',
			type: 'warmup',
			plannedReps: null,
			weight: 60,
			reps: 5,
			rpe: null,
			completed: false
		});

		expect(idsOf(workout).slice(0, 4)).toEqual(['bench-w', 'bench-1', 'bench-w2', 'bench-2']);
	});

	test('the working index is counted per leg, not across the entry', () => {
		const workout = superset(freshWorkout(0));

		expect(at(workout, 'b-1').workingIndex).toBe(0);
		expect(at(workout, 'a-2').workingIndex).toBe(1);
	});
});

describe('moveEntry', () => {
	test('takes the entry and everything under it', () => {
		const workout = freshWorkout(0);

		expect(moveEntry(workout, 'entry-4', 0)).toBe(true);
		expect(orderOf(workout)).toEqual([
			'pec-deck',
			'bench-press',
			'incline-dumbbell-press',
			'cable-fly'
		]);
		expect(idsOf(workout).slice(0, 4)).toEqual(['pecdeck-1', 'pecdeck-2', 'pecdeck-3', 'bench-w']);
	});

	test('moving down lands where the row was, not one short of it', () => {
		const workout = freshWorkout(0);

		expect(moveEntry(workout, 'entry-1', 2)).toBe(true);
		expect(orderOf(workout)).toEqual([
			'incline-dumbbell-press',
			'cable-fly',
			'bench-press',
			'pec-deck'
		]);
	});

	test('a superset moves whole', () => {
		const workout = superset(freshWorkout(0));

		expect(moveEntry(workout, 'superset', 0)).toBe(true);
		expect(orderOf(workout)).toEqual(['cable-fly', 'pec-deck', 'bench-press']);
	});

	test('an index past the end clamps rather than refusing the move', () => {
		const workout = freshWorkout(0);

		expect(moveEntry(workout, 'entry-1', 99)).toBe(true);
		expect(orderOf(workout)).toEqual([
			'incline-dumbbell-press',
			'cable-fly',
			'pec-deck',
			'bench-press'
		]);
	});

	test('landing where it started is a no-op, and says so', () => {
		const workout = freshWorkout(0);

		expect(moveEntry(workout, 'entry-2', 1)).toBe(false);
		expect(orderOf(workout)).toEqual([
			'bench-press',
			'incline-dumbbell-press',
			'cable-fly',
			'pec-deck'
		]);
	});

	test('an unknown entry is refused rather than silently ignored', () => {
		expect(moveEntry(freshWorkout(0), 'nope', 0)).toBe(false);
	});

	test('the set stays put, but the set after it follows the new order', () => {
		const workout = freshWorkout(0);
		completeAll(workout);
		workout.entries[2].exercises[0].sets[0].completed = false;
		workout.entries[3].exercises[0].sets[0].completed = false;

		expect(idOf(advanceFrom(workout, 'bench-4'))).toBe('fly-1');
		expect(idOf(firstUncompleted(workout))).toBe('fly-1');

		moveEntry(workout, 'entry-3', 3);

		expect(cursorFor(workout, 'bench-4')).not.toBeNull();
		expect(idOf(advanceFrom(workout, 'bench-4'))).toBe('pecdeck-1');
		expect(idOf(firstUncompleted(workout))).toBe('pecdeck-1');
	});
});

describe('hintLabel', () => {
	test('spells last time the way both the row and the editor show it', () => {
		const cursor = at(freshWorkout(0), 'bench-4');

		expect(hintLabel(history, cursor, metaOf(cursor))).toBe('77.5 × 7');
	});

	test('null with nothing to recall, and never logged says so apart', () => {
		const cursor = at(freshWorkout(0), 'pecdeck-1');

		expect(hintLabel(history, cursor, metaOf(cursor))).toBeNull();
		expect(neverLogged(history, cursor)).toBe(true);
	});

	test('a set past every session is quiet, not a first time', () => {
		const workout = freshWorkout(0);
		addSet(workout, 'we-bench', 'bench-5');
		const cursor = at(workout, 'bench-5');

		expect(hintLabel(history, cursor, metaOf(cursor))).toBeNull();
		expect(neverLogged(history, cursor)).toBe(false);
	});

	test('a warmup recalls nothing', () => {
		const cursor = at(freshWorkout(0), 'bench-w');

		expect(hintLabel(history, cursor, metaOf(cursor))).toBeNull();
	});

	test('a set last time never reached recalls the older session that did', () => {
		const workout = freshWorkout(0);
		addSet(workout, 'we-bench', 'bench-5');
		const cursor = at(workout, 'bench-5');
		const deeper = {
			'bench-press': [
				...(history['bench-press'] ?? []),
				{ weight: 70, reps: 9, rpe: null, earlier: true as const }
			]
		};

		expect(hintLabel(deeper, cursor, metaOf(cursor))).toBe('70 × 9');
		expect(prefillFor(cursor, deeper)).toEqual({ weight: 70, reps: 9 });
	});

	test('grows how last time felt, in whichever scale it is asked for', () => {
		const cursor = at(freshWorkout(0), 'bench-1');
		const rated = { 'bench-press': [{ weight: 80, reps: 8, rpe: 8 }] };

		expect(hintLabel(rated, cursor, metaOf(cursor), 'rpe')).toBe('80 × 8 · RPE 8');
		expect(hintLabel(rated, cursor, metaOf(cursor), 'rir')).toBe('80 × 8 · RIR 2');
	});

	test('an unrated recall is the bare numbers, scale or no scale', () => {
		const cursor = at(freshWorkout(0), 'bench-4');

		expect(hintLabel(history, cursor, metaOf(cursor), 'rpe')).toBe('77.5 × 7');
	});
});

describe('whole entry', () => {
	test('a rep count refuses the decimal point either way it is typed', () => {
		expect(isWholeDraft('12')).toBe(true);
		expect(isWholeDraft('')).toBe(true);
		expect(isWholeDraft('8.')).toBe(false);
		expect(isWholeDraft('8,5')).toBe(false);
		expect(isWholeDraft('-')).toBe(false);
	});

	test('reads only whole numbers', () => {
		expect(parseWhole(' 10 ')).toBe(10);
		expect(parseWhole('')).toBeNull();
		expect(parseWhole('7.5')).toBeNull();
		expect(parseWhole('1e3')).toBeNull();
	});
});

describe('parseEntry', () => {
	test('a comma is a decimal point', () => {
		expect(parseEntry('82,5')).toBe(82.5);
	});

	test('what is not an affirmative claim is null, not zero', () => {
		expect(parseEntry('')).toBeNull();
		expect(parseEntry('   ')).toBeNull();
		expect(parseEntry('.')).toBeNull();
		expect(parseEntry('-')).toBeNull();
		expect(parseEntry('heavy')).toBeNull();
	});

	test('zero is a claim', () => {
		expect(parseEntry('0')).toBe(0);
	});

	test('a separator may lead or trail the digits', () => {
		expect(parseEntry('.5')).toBe(0.5);
		expect(parseEntry(',5')).toBe(0.5);
		expect(parseEntry('82.')).toBe(82);
	});

	test('a sign is read, and left for settle to clamp', () => {
		expect(parseEntry('-5')).toBe(-5);
		expect(parseEntry('--5')).toBeNull();
		expect(parseEntry('5-')).toBeNull();
	});

	test("the language's wider number dialect is not a number here", () => {
		expect(parseEntry('1e3')).toBeNull();
		expect(parseEntry('0x10')).toBeNull();
		expect(parseEntry('Infinity')).toBeNull();
		expect(parseEntry('1.2.3')).toBeNull();
		expect(parseEntry('82,5 kg')).toBeNull();
	});
});

describe('isEntryDraft', () => {
	test('every prefix of an entry is one', () => {
		expect(isEntryDraft('')).toBe(true);
		expect(isEntryDraft('-')).toBe(true);
		expect(isEntryDraft('.')).toBe(true);
		expect(isEntryDraft('82.')).toBe(true);
		expect(isEntryDraft('-.5')).toBe(true);
		expect(isEntryDraft('82,5')).toBe(true);
	});

	test('what no keystroke can rescue is not', () => {
		expect(isEntryDraft('h')).toBe(false);
		expect(isEntryDraft('82.5.')).toBe(false);
		expect(isEntryDraft('1e')).toBe(false);
		expect(isEntryDraft('0x')).toBe(false);
		expect(isEntryDraft('5-')).toBe(false);
		expect(isEntryDraft(' 5')).toBe(false);
	});
});

describe('settle', () => {
	test('rounds to the finest weight anything displays', () => {
		expect(settle(82.499)).toBe(82.5);
	});

	test('floors at min rather than going negative', () => {
		expect(settle(-5)).toBe(0);
		expect(settle(1, 2.5)).toBe(2.5);
	});

	test('caps at max when it is given one, and never otherwise', () => {
		expect(settle(999)).toBe(999);
		expect(settle(12, 1, 10)).toBe(10);
	});
});

function mint(prefix: string): () => string {
	let n = 0;

	return () => {
		n += 1;

		return `${prefix}-${n}`;
	};
}

function idsIn(workout: Workout): string[] {
	return [
		workout.id,
		...workout.entries.flatMap((entry) => [
			entry.id,
			...entry.exercises.flatMap((ex) => [ex.id, ...ex.sets.map((set) => set.id)])
		])
	];
}

describe('copy-on-repeat', () => {
	test('the shape returns, the performance does not', () => {
		const past = freshWorkout(5000);
		past.templateId = 't1';
		completeAll(past);

		const next = repeatFrom(past, 9000, mint('r'));

		expect(next.startedAt).toBe(9000);
		expect(next.templateId).toBe('t1');
		expect(orderOf(next)).toEqual(orderOf(past));

		const sets = cursors(next).map((c) => c.set);

		expect(sets.length).toBe(13);
		expect(sets.slice(0, 4).map((s) => s.plannedReps)).toEqual([8, 8, 8, 8]);
		expect(
			sets.every((s) => s.type === 'normal' && !s.completed && s.weight === null && s.reps === null)
		).toBe(true);
	});

	test('how a set felt is performance, so it does not repeat either', () => {
		const past = freshWorkout(5000);
		completeAll(past);
		rateSet(past, 'bench-1', 9);

		const next = repeatFrom(past, 9000, mint('r'));

		expect(cursors(next).every((c) => c.set.rpe === null)).toBe(true);
	});

	test('every id is fresh — nothing from the record survives into the session', () => {
		const past = freshWorkout(5000);
		const next = repeatFrom(past, 9000, mint('r'));

		const pastIds = new Set(idsIn(past));
		const nextIds = idsIn(next);

		expect(nextIds.some((id) => pastIds.has(id))).toBe(false);
		expect(new Set(nextIds).size).toBe(nextIds.length);
	});

	test('an exercise of nothing but warmups has no structure to carry', () => {
		const past = freshWorkout(5000);

		for (const set of past.entries[3].exercises[0].sets) {
			set.type = 'warmup';
		}

		const next = repeatFrom(past, 9000, mint('r'));

		expect(orderOf(next)).toEqual(['bench-press', 'incline-dumbbell-press', 'cable-fly']);
	});

	test('how the session was rested repeats with it', () => {
		const past = freshWorkout(5000);
		past.entries[0].exercises[0].restSeconds = 195;
		past.entries[1].exercises[0].restSeconds = null;

		const next = repeatFrom(past, 9000, mint('r'));
		const exercises = next.entries.flatMap((entry) => entry.exercises);

		expect(exercises.map((e) => e.restSeconds)).toEqual([195, null, undefined, undefined]);
		expect('restSeconds' in exercises[2]).toBe(false);
	});

	test('a swapped leg still stands in for the plan it repeats', () => {
		const past = freshWorkout(5000);
		past.templateId = 't1';
		past.entries[1].exercises[0].exerciseId = 'barbell-row';
		past.entries[1].exercises[0].plannedAs = 'incline-dumbbell-press';

		const next = repeatFrom(past, 9000, mint('r'));

		expect(next.entries[1].exercises[0].plannedAs).toBe('incline-dumbbell-press');
		expect('plannedAs' in next.entries[0].exercises[0]).toBe(false);
	});

	test('an optional exercise repeats as optional, and a required one carries no key', () => {
		const past = freshWorkout(5000);
		past.entries[2].exercises[0].optional = true;

		const next = repeatFrom(past, 9000, mint('r'));
		const exercises = next.entries.flatMap((entry) => entry.exercises);

		expect(exercises.map((e) => e.optional)).toEqual([undefined, undefined, true, undefined]);
		expect('optional' in exercises[0]).toBe(false);
	});

	test('an empty start repeats as an empty start', () => {
		expect(repeatFrom(freshWorkout(5000), 9000, mint('r')).templateId).toBeNull();
	});
});

describe('setSetType', () => {
	test('turning set 1 into a warmup makes set 2 the new set 1', () => {
		const workout = freshWorkout(0);

		expect(setSetType(workout, 'bench-1', 'warmup')).toBe(true);

		expect(at(workout, 'bench-1').workingIndex).toBe(-1);
		expect(at(workout, 'bench-2').workingIndex).toBe(0);
		expect(at(workout, 'bench-4').workingIndex).toBe(2);
	});

	test('and turning it back numbers it again, the sets under it shifting back', () => {
		const workout = freshWorkout(0);

		setSetType(workout, 'bench-1', 'warmup');
		setSetType(workout, 'bench-1', 'normal');

		expect(at(workout, 'bench-1').workingIndex).toBe(0);
		expect(at(workout, 'bench-4').workingIndex).toBe(3);
	});

	test('drop and failure stay working sets, numbered and recalled like any other', () => {
		const workout = freshWorkout(0);

		setSetType(workout, 'bench-3', 'drop');
		setSetType(workout, 'bench-4', 'failure');

		expect(at(workout, 'bench-3').workingIndex).toBe(2);
		expect(at(workout, 'bench-4').workingIndex).toBe(3);
		expect(prefillOf(workout, 'bench-4')).toEqual({ weight: 77.5, reps: 8 });
	});

	test('a set that is not there changes nothing', () => {
		expect(setSetType(freshWorkout(0), 'nope', 'warmup')).toBe(false);
	});
});

describe('addWarmup', () => {
	test('lands in front of the working sets, after the warmup already there', () => {
		const workout = freshWorkout(0);
		const set = addWarmup(workout, 'we-bench', 'bench-w2');

		expect(set).toMatchObject({ type: 'warmup' });
		expect(idsOf(workout).slice(0, 4)).toEqual(['bench-w', 'bench-w2', 'bench-1', 'bench-2']);
		expect(at(workout, 'bench-1').workingIndex).toBe(0);
	});

	test('the cursor walks the warmups before the working sets', () => {
		const workout = freshWorkout(0);
		addWarmup(workout, 'we-incline', 'incline-w1');
		addWarmup(workout, 'we-incline', 'incline-w2');

		expect(idOf(advanceFrom(workout, 'bench-4'))).toBe('incline-w1');
		expect(idOf(advanceFrom(workout, 'incline-w1'))).toBe('incline-w2');
		expect(idOf(advanceFrom(workout, 'incline-w2'))).toBe('incline-1');
	});

	test('in a superset every leg warms up ahead of the first round', () => {
		const workout = superset(freshWorkout(0));
		addWarmup(workout, 'we-b', 'b-w');

		expect(idsOf(workout).slice(-6)).toEqual(['b-w', 'a-1', 'b-1', 'a-2', 'b-2', 'a-3']);
	});

	test('takes the grip the exercise is on, and an exercise of only warmups takes one at the end', () => {
		const workout = freshWorkout(0);
		const exercise = workout.entries[3].exercises[0];
		exercise.grip = 'neutral';

		for (const set of exercise.sets) {
			set.type = 'warmup';
		}

		const set = addWarmup(workout, 'we-pecdeck', 'pecdeck-w');

		expect(set).toMatchObject({ grip: 'neutral' });
		expect(exercise.sets.at(-1)).toMatchObject({ id: 'pecdeck-w' });
	});

	test('an exercise that is not there takes nothing', () => {
		expect(addWarmup(freshWorkout(0), 'nope', 'x')).toBeNull();
	});
});

describe('setExerciseNote', () => {
	test('keeps the note trimmed, and an empty one leaves no key behind', () => {
		const workout = freshWorkout(0);
		const exercise = workout.entries[0].exercises[0];

		expect(setExerciseNote(workout, 'we-bench', '  Seat 5, pins on 3  ')).toBe(true);
		expect(exercise.note).toBe('Seat 5, pins on 3');

		setExerciseNote(workout, 'we-bench', '   ');

		expect('note' in exercise).toBe(false);
	});

	test('an exercise that is not there takes nothing', () => {
		expect(setExerciseNote(freshWorkout(0), 'nope', 'hi')).toBe(false);
	});

	test('a repeat leaves the note behind with the day it was about', () => {
		const past = freshWorkout(5000);
		completeAll(past);
		setExerciseNote(past, 'we-bench', 'Left shoulder');

		const next = repeatFrom(past, 9000, mint('r'));

		expect(next.entries.some((entry) => entry.exercises.some((e) => 'note' in e))).toBe(false);
	});
});

// Every warmup on the exercise replaced by `count` fresh ones, ids `<key>-w1`… in order.
function warmingUp(workout: Workout, index: number, key: string, count: number): string[] {
	const exercise = workout.entries[index].exercises[0];

	exercise.sets = exercise.sets.filter((set) => set.type !== 'warmup');

	const ids = Array.from({ length: count }, (_, i) => `${key}-w${i + 1}`);

	for (const id of ids) {
		addWarmup(workout, exercise.id, id);
	}

	return ids;
}

function rampOf(workout: Workout, setId: string, recall: History = history): Prefill {
	const cursor = at(workout, setId);

	return prefillFor(cursor, recall, metaOf(cursor));
}

describe('the warmup ramp', () => {
	test('one warmup is half the first working set, for eight', () => {
		const workout = freshWorkout(0);
		const [w1] = warmingUp(workout, 0, 'bench', 1);

		expect(rampOf(workout, w1)).toEqual({ weight: 40, reps: 8 });
	});

	test('three climb to ~85 %, rounded down to the jumps a bar takes', () => {
		const workout = freshWorkout(0);
		const ids = warmingUp(workout, 0, 'bench', 3);

		expect(ids.map((id) => rampOf(workout, id))).toEqual([
			{ weight: 40, reps: 8 },
			{ weight: 55, reps: 5 },
			{ weight: 67.5, reps: 3 }
		]);
	});

	test('adding them one at a time leaves the ones above where they were', () => {
		const workout = freshWorkout(0);
		const [w1] = warmingUp(workout, 0, 'bench', 1);
		const before = rampOf(workout, w1);

		addWarmup(workout, 'we-bench', 'bench-w2');
		addWarmup(workout, 'we-bench', 'bench-w3');

		expect(rampOf(workout, w1)).toEqual(before);
		expect(rampOf(workout, 'bench-w2')).toEqual({ weight: 55, reps: 5 });
	});

	test('a fourth goes in underneath, on the empty bar', () => {
		const workout = freshWorkout(0);
		const ids = warmingUp(workout, 0, 'bench', 4);
		const cursor = at(workout, ids[0]);
		const ramp = rampFor(cursor, history, metaOf(cursor));

		expect(ids.map((id) => rampOf(workout, id).weight)).toEqual([20, 40, 55, 67.5]);
		expect(ramp).toMatchObject({ reps: 10, bar: true });
		expect(ramp === null ? null : rampLabel(ramp, metaOf(cursor))).toBe('Empty bar');
	});

	test('without a bar the light rung is ~30 %, and dumbbells round to the pairs a rack holds', () => {
		const workout = freshWorkout(0);
		const ids = warmingUp(workout, 1, 'incline', 4);

		expect(ids.map((id) => rampOf(workout, id).weight)).toEqual([9, 14, 20, 24]);
	});

	test('climbs to what set 1 itself says once the lifter has said it', () => {
		const workout = freshWorkout(0);
		const [w1] = warmingUp(workout, 0, 'bench', 1);

		draftSet(workout, 'bench-1', { weight: 100, reps: 5 });

		expect(rampOf(workout, w1)).toEqual({ weight: 50, reps: 8 });
	});

	test('names its rung as the card says it', () => {
		const workout = freshWorkout(0);
		const [w1] = warmingUp(workout, 0, 'bench', 1);
		const cursor = at(workout, w1);
		const ramp = rampFor(cursor, history, metaOf(cursor));

		expect(ramp === null ? null : rampLabel(ramp, metaOf(cursor))).toBe('50 % of 80 kg');
	});

	test('on an unloaded pull-up the body is the whole of it and the reps taper alone', () => {
		const workout = freshWorkout(0);
		workout.entries[3].exercises[0].exerciseId = 'pull-up';
		const ids = warmingUp(workout, 3, 'pull', 2);
		const recall: History = { 'pull-up': [{ weight: 0, reps: 10, rpe: null }] };
		const cursor = at(workout, ids[0]);
		const ramp = rampFor(cursor, recall, metaOf(cursor));

		expect(ids.map((id) => rampOf(workout, id, recall))).toEqual([
			{ weight: 0, reps: 8 },
			{ weight: 0, reps: 5 }
		]);
		expect(ramp === null ? undefined : rampLabel(ramp, metaOf(cursor))).toBeNull();
	});

	test('nothing to climb towards leaves the warmup blank', () => {
		const workout = freshWorkout(0);
		const [w1] = warmingUp(workout, 0, 'bench', 1);

		const cursor = at(workout, w1);

		expect(rampOf(workout, w1, {})).toEqual({ weight: null, reps: null });
		expect(rampFor(cursor, {}, metaOf(cursor))).toBeNull();
	});

	test('a warmup the lifter has spoken for is its own, and a working set has no ramp', () => {
		const workout = freshWorkout(0);

		expect(rampOf(workout, 'bench-w')).toEqual({ weight: 40, reps: 10 });
		expect(rampFor(at(workout, 'bench-1'), history)).toBeNull();
	});

	test('the offer is never written into the set', () => {
		const workout = freshWorkout(0);
		const [w1] = warmingUp(workout, 0, 'bench', 1);

		rampOf(workout, w1);

		expect(at(workout, w1).set).toMatchObject({ weight: null, reps: null, completed: false });
		expect('entered' in at(workout, w1).set).toBe(false);
	});
});
