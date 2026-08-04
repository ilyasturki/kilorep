import { describe, expect, test } from 'vitest';

import { freshWorkout, history } from '$lib/domain/fixture';
import {
	addExercise,
	addExerciseTo,
	addSet,
	advanceFrom,
	canCommit,
	commitSet,
	cursorFor,
	cursors,
	draftSet,
	firstUncompleted,
	hintFor,
	hintLabel,
	insertedSetCount,
	joinEntry,
	markSet,
	moveEntry,
	parseEntry,
	prefillFor,
	rateSet,
	removeExercise,
	removeSet,
	repeatFrom,
	replaceExercise,
	settle,
	splitEntry,
	supersetWith
} from '$lib/domain/workout';
import type { Prefill, SetCursor, Workout, WorkoutSet } from '$lib/domain/workout';

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
	return prefillFor(at(workout, setId), history);
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

	test('the plan still owns the reps when it disagrees with the carry', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'bench-1', 82.5, 6);

		expect(prefillOf(workout, 'bench-2')).toEqual({ weight: 82.5, reps: 8 });
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

		const prefill = prefillFor(at(workout, 'fly2-1'), history);

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
		expect(hintLabel(history, cursor)).toBe('80 × 8');
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

describe('replaceExercise', () => {
	const ids = { exercise: 'we-row', sets: ['row-1', 'row-2', 'row-3'] };

	test('keeps the slot and changes what is performed in it', () => {
		const workout = freshWorkout(0);
		const exercise = replaceExercise(workout, 'we-incline', 'barbell-row', ids);

		expect(workout.entries[1].exercises[0]).toBe(exercise);
		expect(workout.entries[1].id).toBe('entry-2');
		expect(orderOf(workout)).toEqual(['bench-press', 'barbell-row', 'cable-fly', 'pec-deck']);
	});

	test('the sets are the incoming exercise, blank — nothing is carried across', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'incline-1', 30, 10);
		replaceExercise(workout, 'we-incline', 'barbell-row', ids);

		expect(idsOf(workout)).not.toContain('incline-1');
		expect(idsOf(workout).slice(5, 8)).toEqual(['row-1', 'row-2', 'row-3']);
		expect(at(workout, 'row-1').set).toEqual(openSet('row-1', null));
	});

	test('zero sets is refused, and the slot it would have emptied is left alone', () => {
		const workout = freshWorkout(0);

		expect(
			replaceExercise(workout, 'we-incline', 'barbell-row', { exercise: 'we-row', sets: [] })
		).toBeNull();
		expect(orderOf(workout)[1]).toBe('incline-dumbbell-press');
	});

	test('an unknown exercise is refused rather than silently ignored', () => {
		expect(replaceExercise(freshWorkout(0), 'nope', 'barbell-row', ids)).toBeNull();
	});

	test('the other leg of a superset is untouched', () => {
		const workout = superset(freshWorkout(0));
		commitSet(workout, 'b-1', 12, 15);

		replaceExercise(workout, 'we-a', 'barbell-row', ids);

		expect(workout.entries[1].exercises.map((e) => e.id)).toEqual(['we-row', 'we-b']);
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

	test('once the tail is exhausted it comes back for the gaps left behind', () => {
		const workout = freshWorkout(0);

		for (const id of ['pecdeck-1', 'pecdeck-2', 'pecdeck-3']) {
			commitSet(workout, id, 45, 10);
		}

		expect(idOf(advanceFrom(workout, 'pecdeck-3'))).toBe('bench-1');
	});

	test('null when every set is logged, which is the only finished signal', () => {
		const workout = freshWorkout(0);
		completeAll(workout);

		expect(advanceFrom(workout, 'pecdeck-3')).toBeNull();
		expect(firstUncompleted(workout)).toBeNull();
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

		expect(hintLabel(history, cursor)).toBe('77.5 × 7');
	});

	test('null with nothing to recall, so the caller can say "First time"', () => {
		const cursor = at(freshWorkout(0), 'pecdeck-1');

		expect(hintLabel(history, cursor)).toBeNull();
	});

	test('grows how last time felt, in whichever scale it is asked for', () => {
		const cursor = at(freshWorkout(0), 'bench-1');
		const rated = { 'bench-press': [{ weight: 80, reps: 8, rpe: 8 }] };

		expect(hintLabel(rated, cursor, 'rpe')).toBe('80 × 8 · RPE 8');
		expect(hintLabel(rated, cursor, 'rir')).toBe('80 × 8 · RIR 2');
	});

	test('an unrated recall is the bare numbers, scale or no scale', () => {
		const cursor = at(freshWorkout(0), 'bench-4');

		expect(hintLabel(history, cursor, 'rpe')).toBe('77.5 × 7');
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
		expect(parseEntry('heavy')).toBeNull();
	});

	test('zero is a claim', () => {
		expect(parseEntry('0')).toBe(0);
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

	test('an empty start repeats as an empty start', () => {
		expect(repeatFrom(freshWorkout(5000), 9000, mint('r')).templateId).toBeNull();
	});
});
