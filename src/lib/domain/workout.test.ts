import { describe, expect, test } from 'vitest';

import { freshWorkout, history } from '$lib/domain/fixture';
import {
	addExercise,
	addSet,
	advanceFrom,
	canCommit,
	commitSet,
	cursorFor,
	cursors,
	draftSet,
	firstUncompleted,
	groupsOf,
	hintFor,
	hintLabel,
	insertedSetCount,
	moveEntry,
	parseEntry,
	prefillFor,
	removeEntry,
	removeSet,
	replaceEntry,
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

/** Session order by exercise, which is the thing a reorder is judged on. */
function orderOf(workout: Workout): string[] {
	return groupsOf(workout).map((g) => g.exerciseId);
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
		expect(hintFor(history, 'bench-press', 0)).toEqual({ weight: 80, reps: 8 });
		expect(hintFor(history, 'bench-press', 3)).toEqual({ weight: 77.5, reps: 7 });
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

	// The whole point of the pair being written together: a draft that skipped
	// nulls could put a number into a set and never take it back out.
	test('null is a value, not a slot to skip', () => {
		const workout = freshWorkout(0);
		draftSet(workout, 'bench-1', { weight: 80, reps: 8 });

		expect(draftSet(workout, 'bench-1', { weight: null, reps: null })).toBe(true);
		expect(at(workout, 'bench-1').set).toMatchObject({ weight: null, reps: null });
	});

	// Seeding a set is `draftSet` of its own prefill, and `prefillFor` reads what
	// the set already holds first — so a set that has been drafted, or logged,
	// opens on itself and seeding it again changes nothing.
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

	test('an unknown set is refused rather than silently ignored', () => {
		expect(draftSet(freshWorkout(0), 'nope', { weight: 60, reps: 8 })).toBe(false);
	});
});

describe('addSet', () => {
	test('appends an empty working set, planning nothing', () => {
		const workout = freshWorkout(0);
		const set = addSet(workout, 'we-bench', 'bench-5');

		expect(set).toEqual({
			id: 'bench-5',
			type: 'normal',
			plannedReps: null,
			weight: null,
			reps: null,
			completed: false
		});
		// At the foot of its own exercise, not the foot of the session.
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

	// History has four bench sets. The fifth is a set nothing recalls, and the
	// screen has to be able to say so rather than guess it from its neighbour.
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

		// Blank and unplanned: nothing prescribed these sets, and the hint path
		// resolves them from history by index without any copying here.
		expect(entry!.exercises[0].sets[0]).toEqual({
			id: 'row-1',
			type: 'normal',
			plannedReps: null,
			weight: null,
			reps: null,
			completed: false
		});
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

	// The set numbers are positional, so removing one renumbers the rest — and
	// with them the hint each remaining set looks up.
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

describe('replaceEntry', () => {
	const ids = { exercise: 'we-row', sets: ['row-1', 'row-2', 'row-3'] };

	test('keeps the slot and changes what is performed in it', () => {
		const workout = freshWorkout(0);
		const entry = replaceEntry(workout, 'entry-2', 'barbell-row', ids);

		// Second of four, exactly where incline was. A remove-and-add would have
		// dropped it at the end and made the user drag it back.
		expect(workout.entries[1]).toBe(entry);
		expect(entry!.id).toBe('entry-2');
		expect(orderOf(workout)).toEqual(['bench-press', 'barbell-row', 'cable-fly', 'pec-deck']);
	});

	test('the sets are the incoming exercise, blank — nothing is carried across', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'incline-1', 30, 10);
		replaceEntry(workout, 'entry-2', 'barbell-row', ids);

		expect(idsOf(workout)).not.toContain('incline-1');
		expect(idsOf(workout).slice(5, 8)).toEqual(['row-1', 'row-2', 'row-3']);
		expect(at(workout, 'row-1').set).toEqual({
			id: 'row-1',
			type: 'normal',
			plannedReps: null,
			weight: null,
			reps: null,
			completed: false
		});
	});

	test('zero sets is refused, and the entry it would have emptied is left alone', () => {
		const workout = freshWorkout(0);

		expect(replaceEntry(workout, 'entry-2', 'barbell-row', { exercise: 'we-row', sets: [] })).toBe(
			null
		);
		expect(orderOf(workout)[1]).toBe('incline-dumbbell-press');
	});

	test('an unknown entry is refused rather than silently ignored', () => {
		expect(replaceEntry(freshWorkout(0), 'nope', 'barbell-row', ids)).toBeNull();
	});
});

describe('removeEntry', () => {
	test('takes the exercise and every set under it, logged or not', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'incline-1', 30, 10);

		expect(removeEntry(workout, 'entry-2')).toBe(true);
		expect(orderOf(workout)).toEqual(['bench-press', 'cable-fly', 'pec-deck']);
		expect(idsOf(workout)).not.toContain('incline-1');
	});

	// No floor, unlike `removeSet`. An empty session is where every session
	// starts, so there is nothing here to refuse.
	test('the last entry goes too, leaving an empty session', () => {
		const workout = freshWorkout(0);

		for (const id of ['entry-1', 'entry-2', 'entry-3', 'entry-4']) {
			expect(removeEntry(workout, id)).toBe(true);
		}

		expect(workout.entries).toEqual([]);
		expect(firstUncompleted(workout)).toBeNull();
	});

	test('an unknown entry is refused rather than silently ignored', () => {
		expect(removeEntry(freshWorkout(0), 'nope')).toBe(false);
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

describe('groupsOf', () => {
	test('one group per exercise, in session order, warmup included', () => {
		const groups = groupsOf(freshWorkout(0));

		expect(groups.map((g) => g.exerciseId)).toEqual([
			'bench-press',
			'incline-dumbbell-press',
			'cable-fly',
			'pec-deck'
		]);
		// The node id, not the catalog id — what tells two performances of the
		// same exercise apart.
		expect(groups.map((g) => g.id)).toEqual(['we-bench', 'we-incline', 'we-fly', 'we-pecdeck']);
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

	test('both halves of a superset name the one entry a reorder would move', () => {
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

		expect(groupsOf(workout).map((g) => g.entryId)).toEqual(['superset', 'superset']);
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

	// A superset is one entry and two groups. Dragging it must not leave half of
	// it three exercises away from the other half.
	test('a superset moves whole', () => {
		const workout = freshWorkout(0);

		workout.entries = [
			workout.entries[0],
			{
				id: 'superset',
				exercises: [
					{ id: 'we-a', exerciseId: 'fly', sets: [openSet('a-1')] },
					{ id: 'we-b', exerciseId: 'pecdeck', sets: [openSet('b-1')] }
				]
			}
		];

		expect(moveEntry(workout, 'superset', 0)).toBe(true);
		expect(orderOf(workout)).toEqual(['fly', 'pecdeck', 'bench-press']);
	});

	// The drag computes this index off row midpoints, so the last row is exactly
	// where a rounding error lands.
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

	// Reordering is not a jump: the set stays exactly where the cursor left it,
	// and what changes is what comes *next* — because the advance reads position
	// at the moment it is asked rather than remembering one.
	test('the set stays put, but the set after it follows the new order', () => {
		const workout = freshWorkout(0);
		completeAll(workout);
		// Two gaps, one in fly and one in pecdeck, with fly above.
		workout.entries[2].exercises[0].sets[0].completed = false;
		workout.entries[3].exercises[0].sets[0].completed = false;

		expect(idOf(advanceFrom(workout, 'bench-4'))).toBe('fly-1');
		expect(idOf(firstUncompleted(workout))).toBe('fly-1');

		// Fly goes to the foot of the session, so pecdeck is now the nearer gap.
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
