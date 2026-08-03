import { describe, expect, test } from 'vitest';

import {
	addExercise,
	addSet,
	blankTemplate,
	isBlank,
	moveEntry,
	removeExercise,
	removeSet,
	replaceExercise,
	setExerciseReps,
	setPlannedReps,
	startFrom
} from '$lib/domain/template';
import type { Template } from '$lib/domain/template';

/**
 * The rules that break silently.
 *
 * A wrong blank rule writes junk records or eats a real one; a copy-on-start
 * that reuses an id lets the store confuse two Tuesdays; a planned target of
 * zero is a plan nobody made. The editor's layout is judged by thumb; these
 * are judged here.
 */

let n = 0;

/** Deterministic ids, so a test can name the node it means. */
function mint(prefix: string): () => string {
	return () => {
		n += 1;

		return `${prefix}-${n}`;
	};
}

/** A planned exercise appended with `count` sets, ids readable per node. */
function plan(template: Template, exerciseId: string, count: number): void {
	addExercise(template, exerciseId, {
		entry: `${exerciseId}-entry`,
		exercise: `${exerciseId}-node`,
		sets: Array.from({ length: count }, (_, i) => `${exerciseId}-set-${i + 1}`)
	});
}

/** Every planned target under one exercise node, in order. */
function targetsOf(template: Template, exerciseId: string): (number | null)[] {
	const exercise = template.entries
		.flatMap((entry) => entry.exercises)
		.find((candidate) => candidate.id === exerciseId);

	return exercise === undefined ? [] : exercise.sets.map((set) => set.plannedReps);
}

/** Session order by exercise, which is the thing a reorder is judged on. */
function orderOf(template: Template): string[] {
	return template.entries.flatMap((entry) => entry.exercises.map((e) => e.exerciseId));
}

/**
 * Every node id in a tree, walked. Structural on purpose: templates and the
 * workouts they start share the levels, and the whole point of the test that
 * uses this is comparing the two.
 */
type IdTree = {
	id: string;
	entries: { id: string; exercises: { id: string; sets: { id: string }[] }[] }[];
};

function idsIn(tree: IdTree): string[] {
	const out = [tree.id];

	for (const entry of tree.entries) {
		out.push(entry.id);

		for (const exercise of entry.exercises) {
			out.push(exercise.id);

			for (const set of exercise.sets) {
				out.push(set.id);
			}
		}
	}

	return out;
}

describe('the blank rule', () => {
	test('a fresh template is blank', () => {
		expect(isBlank(blankTemplate('t1', 100))).toBe(true);
	});

	test('whitespace is not a name', () => {
		const template = blankTemplate('t1', 100);
		template.name = '   ';

		expect(isBlank(template)).toBe(true);
	});

	test('a name alone escapes blankness, and so does an exercise alone', () => {
		const named = blankTemplate('t1', 100);
		named.name = 'Push day';
		expect(isBlank(named)).toBe(false);

		const planned = blankTemplate('t2', 100);
		plan(planned, 'bench-press', 3);
		expect(isBlank(planned)).toBe(false);
	});
});

describe('planning exercises', () => {
	test('an exercise lands at the end as its own entry, sets open', () => {
		const template = blankTemplate('t1', 100);
		plan(template, 'bench-press', 3);
		plan(template, 'cable-fly', 2);

		expect(orderOf(template)).toEqual(['bench-press', 'cable-fly']);
		expect(template.entries[0].exercises[0].sets).toHaveLength(3);
		expect(template.entries[0].exercises[0].sets.every((s) => s.plannedReps === null)).toBe(true);
	});

	test('no set ids is no exercise', () => {
		const template = blankTemplate('t1', 100);

		const entry = addExercise(template, 'bench-press', { entry: 'e', exercise: 'x', sets: [] });

		expect(entry).toBeNull();
		expect(template.entries).toEqual([]);
	});

	test('removing an exercise takes its emptied entry along', () => {
		const template = blankTemplate('t1', 100);
		plan(template, 'bench-press', 3);
		plan(template, 'cable-fly', 2);

		expect(removeExercise(template, 'bench-press-node')).toBe(true);

		expect(orderOf(template)).toEqual(['cable-fly']);
		expect(template.entries).toHaveLength(1);
	});

	test('removing an unknown exercise is refused', () => {
		const template = blankTemplate('t1', 100);
		plan(template, 'bench-press', 3);

		expect(removeExercise(template, 'nope')).toBe(false);
		expect(template.entries).toHaveLength(1);
	});

	test('a swap keeps the plan and every id, and stays where it stood', () => {
		const template = blankTemplate('t1', 100);
		plan(template, 'bench-press', 3);
		plan(template, 'cable-fly', 2);

		setPlannedReps(template, 'bench-press-set-1', 12);
		setPlannedReps(template, 'bench-press-set-2', 10);
		setPlannedReps(template, 'bench-press-set-3', 8);

		const before = idsIn(template);

		expect(replaceExercise(template, 'bench-press-node', 'incline-press')).toBe(true);

		// The pyramid is the user's, not the barbell's: it survives whole.
		expect(targetsOf(template, 'bench-press-node')).toEqual([12, 10, 8]);
		// First still, not shuffled to the end the way a remove-and-add would.
		expect(orderOf(template)).toEqual(['incline-press', 'cable-fly']);
		expect(idsIn(template)).toEqual(before);
	});

	test('a swap to what is already planned, and one to an unknown node, are no-ops', () => {
		const template = blankTemplate('t1', 100);
		plan(template, 'bench-press', 3);

		expect(replaceExercise(template, 'bench-press-node', 'bench-press')).toBe(false);
		expect(replaceExercise(template, 'nope', 'incline-press')).toBe(false);

		expect(orderOf(template)).toEqual(['bench-press']);
	});

	test('the same exercise may be planned twice, swapped into or added', () => {
		const template = blankTemplate('t1', 100);
		plan(template, 'bench-press', 3);
		plan(template, 'cable-fly', 2);

		expect(replaceExercise(template, 'cable-fly-node', 'bench-press')).toBe(true);
		expect(orderOf(template)).toEqual(['bench-press', 'bench-press']);
	});
});

describe('planning sets', () => {
	test('an added set copies the target above it', () => {
		const template = blankTemplate('t1', 100);
		plan(template, 'bench-press', 2);
		setPlannedReps(template, 'bench-press-set-2', 8);

		const set = addSet(template, 'bench-press-node', 'bench-press-set-3');

		expect(set).toEqual({ id: 'bench-press-set-3', plannedReps: 8 });
	});

	test('an added set under an open target stays open', () => {
		const template = blankTemplate('t1', 100);
		plan(template, 'bench-press', 1);

		const set = addSet(template, 'bench-press-node', 'bench-press-set-2');

		expect(set).toEqual({ id: 'bench-press-set-2', plannedReps: null });
	});

	test('the last set cannot be removed', () => {
		const template = blankTemplate('t1', 100);
		plan(template, 'bench-press', 2);

		expect(removeSet(template, 'bench-press-set-1')).toBe(true);
		expect(removeSet(template, 'bench-press-set-2')).toBe(false);
		expect(template.entries[0].exercises[0].sets).toHaveLength(1);
	});

	test('a target below one is refused; null clears to open', () => {
		const template = blankTemplate('t1', 100);
		plan(template, 'bench-press', 1);

		expect(setPlannedReps(template, 'bench-press-set-1', 0)).toBe(false);
		expect(template.entries[0].exercises[0].sets[0].plannedReps).toBeNull();

		expect(setPlannedReps(template, 'bench-press-set-1', 8)).toBe(true);
		expect(setPlannedReps(template, 'bench-press-set-1', null)).toBe(true);
		expect(template.entries[0].exercises[0].sets[0].plannedReps).toBeNull();
	});

	test('the shared target writes every set of one exercise, and only that one', () => {
		const template = blankTemplate('t1', 100);
		plan(template, 'bench-press', 3);
		plan(template, 'cable-fly', 2);

		expect(setExerciseReps(template, 'bench-press-node', 8)).toBe(true);

		expect(targetsOf(template, 'bench-press-node')).toEqual([8, 8, 8]);
		expect(targetsOf(template, 'cable-fly-node')).toEqual([null, null]);
	});

	test('the shared target clears to open, and refuses a target below one', () => {
		const template = blankTemplate('t1', 100);
		plan(template, 'bench-press', 2);
		setExerciseReps(template, 'bench-press-node', 8);

		expect(setExerciseReps(template, 'bench-press-node', 0)).toBe(false);
		expect(targetsOf(template, 'bench-press-node')).toEqual([8, 8]);

		expect(setExerciseReps(template, 'bench-press-node', null)).toBe(true);
		expect(targetsOf(template, 'bench-press-node')).toEqual([null, null]);
	});

	test('the shared target reports an unknown exercise rather than writing nothing quietly', () => {
		const template = blankTemplate('t1', 100);
		plan(template, 'bench-press', 1);

		expect(setExerciseReps(template, 'nope', 8)).toBe(false);
	});
});

describe('reorder', () => {
	test('moves an entry and clamps a drag past the end', () => {
		const template = blankTemplate('t1', 100);
		plan(template, 'bench-press', 1);
		plan(template, 'cable-fly', 1);
		plan(template, 'pec-deck', 1);

		expect(moveEntry(template, 'bench-press-entry', 99)).toBe(true);
		expect(orderOf(template)).toEqual(['cable-fly', 'pec-deck', 'bench-press']);
	});

	test('a move that lands where it started reports the no-op', () => {
		const template = blankTemplate('t1', 100);
		plan(template, 'bench-press', 1);

		expect(moveEntry(template, 'bench-press-entry', 0)).toBe(false);
		expect(moveEntry(template, 'nope', 0)).toBe(false);
	});
});

describe('copy-on-start', () => {
	function pushDay(): Template {
		const template = blankTemplate('t1', 100);
		template.name = 'Push day';
		plan(template, 'bench-press', 2);
		plan(template, 'cable-fly', 1);
		setPlannedReps(template, 'bench-press-set-1', 8);

		return template;
	}

	test('the workout mirrors the tree with everything unlogged', () => {
		const workout = startFrom(pushDay(), 5000, mint('w'));

		expect(workout.templateId).toBe('t1');
		expect(workout.startedAt).toBe(5000);
		expect(workout.entries.map((e) => e.exercises[0].exerciseId)).toEqual([
			'bench-press',
			'cable-fly'
		]);

		const sets = workout.entries.flatMap((e) => e.exercises.flatMap((x) => x.sets));

		expect(sets.map((s) => s.plannedReps)).toEqual([8, null, null]);
		expect(
			sets.every((s) => !s.completed && s.weight === null && s.reps === null && s.type === 'normal')
		).toBe(true);
	});

	test('every id is fresh — nothing from the template survives into the record', () => {
		const template = pushDay();
		const workout = startFrom(template, 5000, mint('w'));

		const templateIds = new Set(idsIn(template));
		const workoutIds = idsIn(workout);

		expect(workoutIds.some((id) => templateIds.has(id))).toBe(false);
		expect(new Set(workoutIds).size).toBe(workoutIds.length);
	});

	test('starting twice yields two distinct workouts', () => {
		const template = pushDay();

		const first = startFrom(template, 5000, mint('a'));
		const second = startFrom(template, 6000, mint('b'));

		expect(first.id).not.toBe(second.id);
		expect(first.entries[0].id).not.toBe(second.entries[0].id);
	});

	test('an empty template starts an empty workout', () => {
		const workout = startFrom(blankTemplate('t9', 100), 5000, mint('w'));

		expect(workout.entries).toEqual([]);
		expect(workout.templateId).toBe('t9');
	});
});
