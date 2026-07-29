import { describe, expect, test } from 'vitest';

import { freshWorkout, history } from '$lib/domain/fixture';
import {
	advanceFrom,
	canCommit,
	commitSet,
	cursorFor,
	cursors,
	firstUncompleted,
	groupsOf,
	hintFor,
	hintLabel,
	parseEntry,
	prefillFor,
	progressOf,
	restRemaining,
	settle
} from '$lib/domain/workout';
import type { Prefill, SetCursor, Workout, WorkoutSet } from '$lib/domain/workout';

/**
 * The rules that break silently.
 *
 * Every one of these is a case the screen cannot be trusted to reveal: an
 * off-by-one in the hint lookup reads as a plausible weight, a wrong advance
 * looks like a jump the user half-remembers making, and a check that goes live
 * on an untouched zero logs a set nobody performed. The layout is judged by
 * thumb; these are judged here.
 */

function idsOf(workout: Workout): string[] {
	return cursors(workout).map((c) => c.set.id);
}

/** A bare uncompleted set, for the shapes the fixture deliberately does not have. */
function openSet(id: string): WorkoutSet {
	return { id, type: 'normal', plannedReps: 10, weight: null, reps: null, completed: false };
}

/** A missing cursor is a broken fixture, so it fails loudly instead of widening every type. */
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

/** Log every set from the top, which is the ordinary linear path through a session. */
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
		expect(hintFor(history, 'bench', 0)).toEqual({ weight: 80, reps: 8 });
		expect(hintFor(history, 'bench', 3)).toEqual({ weight: 77.5, reps: 7 });
	});

	test('an exercise never performed has no hint', () => {
		expect(hintFor(history, 'pecdeck', 0)).toBeNull();
	});

	test('a warmup has no hint, and asking does not read index -1 off the end', () => {
		expect(hintFor(history, 'bench', -1)).toBeNull();
	});

	test('a set beyond last time has no hint', () => {
		expect(hintFor(history, 'fly', 5)).toBeNull();
	});
});

describe('prefillFor', () => {
	test('weight recalls, reps prefer the plan over the recall', () => {
		// Last time's fourth bench set was 77.5 × 7, but 8 reps are planned today.
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

		// Sets 1–3 are still open above it, and it goes forward anyway.
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

describe('progressOf', () => {
	test('counts working sets only, so a logged warmup is not progress', () => {
		const workout = freshWorkout(0);
		const bench = workout.entries[0].exercises[0];

		expect(progressOf(bench)).toEqual({ done: 0, total: 4 });

		commitSet(workout, 'bench-1', 80, 8);
		expect(progressOf(bench)).toEqual({ done: 1, total: 4 });
	});
});

describe('groupsOf', () => {
	test('one group per exercise, in session order, warmup included', () => {
		const groups = groupsOf(freshWorkout(0));

		expect(groups.map((g) => g.exerciseId)).toEqual(['bench', 'incline', 'fly', 'pecdeck']);
		expect(groups[0].cursors.map((c) => c.set.id)).toEqual([
			'bench-w',
			'bench-1',
			'bench-2',
			'bench-3',
			'bench-4'
		]);
	});

	/**
	 * The one rule in this build that exists only for supersets, and the fixture
	 * has no superset to exercise it. Built here instead, because a screen that
	 * merged the two halves of a superset would look plausible while being wrong.
	 */
	test('a superset stays two adjacent groups rather than merging', () => {
		const workout = freshWorkout(0);

		workout.entries = [
			{
				id: 'superset',
				exercises: [
					{ id: 'we-a', exerciseId: 'bench', sets: [openSet('a-1')] },
					{ id: 'we-b', exerciseId: 'fly', sets: [openSet('b-1')] }
				]
			}
		];

		expect(groupsOf(workout).map((g) => g.exerciseId)).toEqual(['bench', 'fly']);
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
});

describe('restRemaining', () => {
	test('counts down from the stored start', () => {
		expect(restRemaining(1000, 90, 1000)).toBe(90);
		expect(restRemaining(1000, 90, 31_000)).toBe(60);
	});

	test('floors at zero rather than going negative when nobody was looking', () => {
		expect(restRemaining(1000, 90, 500_000)).toBe(0);
	});
});
