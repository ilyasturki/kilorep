import { describe, expect, test } from 'vitest';

import {
	addExercise,
	addExerciseTo,
	addSet,
	blankTemplate,
	isBlank,
	joinEntry,
	moveEntry,
	removeExercise,
	removeSet,
	replaceExercise,
	setExerciseReps,
	setPlannedReps,
	splitEntry,
	startFrom,
	supersetWith
} from '$lib/domain/template';
import type { Template } from '$lib/domain/template';

let n = 0;

function mint(prefix: string): () => string {
	return () => {
		n += 1;

		return `${prefix}-${n}`;
	};
}

function plan(template: Template, exerciseId: string, count: number): void {
	addExercise(template, exerciseId, {
		entry: `${exerciseId}-entry`,
		exercise: `${exerciseId}-node`,
		sets: Array.from({ length: count }, (_, i) => `${exerciseId}-set-${i + 1}`)
	});
}

function targetsOf(template: Template, exerciseId: string): (number | null)[] {
	const exercise = template.entries
		.flatMap((entry) => entry.exercises)
		.find((candidate) => candidate.id === exerciseId);

	return exercise === undefined ? [] : exercise.sets.map((set) => set.plannedReps);
}

function orderOf(template: Template): string[] {
	return template.entries.flatMap((entry) => entry.exercises.map((e) => e.exerciseId));
}

type IdTree = {
	id: string;
	entries: { id: string; exercises: { id: string; sets: { id: string }[] }[] }[];
};

function idsIn(tree: IdTree): string[] {
	return [
		tree.id,
		...tree.entries.flatMap((entry) => [
			entry.id,
			...entry.exercises.flatMap((ex) => [ex.id, ...ex.sets.map((set) => set.id)])
		])
	];
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

		expect(targetsOf(template, 'bench-press-node')).toEqual([12, 10, 8]);
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

describe('planning supersets', () => {
	function pair(): Template {
		const template = blankTemplate('t1', 100);

		plan(template, 'cable-fly', 3);
		plan(template, 'lateral-raise', 3);

		return template;
	}

	test('joining moves the exercise in and takes its entry with it', () => {
		const template = pair();

		expect(joinEntry(template, 'cable-fly-entry', 'lateral-raise-node')).toBe(true);
		expect(template.entries).toHaveLength(1);
		expect(template.entries[0].exercises.map((e) => e.exerciseId)).toEqual([
			'cable-fly',
			'lateral-raise'
		]);
	});

	test('the targets ride along', () => {
		const template = pair();
		setPlannedReps(template, 'lateral-raise-set-1', 15);

		joinEntry(template, 'cable-fly-entry', 'lateral-raise-node');

		expect(targetsOf(template, 'lateral-raise-node')).toEqual([15, null, null]);
	});

	test('an exercise already in the entry is an honest no-op', () => {
		const template = pair();

		expect(joinEntry(template, 'cable-fly-entry', 'cable-fly-node')).toBe(false);
		expect(template.entries).toHaveLength(2);
	});

	test('breaking puts the legs back as their own entries, in place', () => {
		const template = pair();
		joinEntry(template, 'cable-fly-entry', 'lateral-raise-node');

		expect(splitEntry(template, 'cable-fly-entry', mint('e'))).toBe(true);
		expect(orderOf(template)).toEqual(['cable-fly', 'lateral-raise']);
		expect(template.entries[0].id).toBe('cable-fly-entry');
		expect(template.entries).toHaveLength(2);
	});

	test('a lone exercise was never a superset, and says so', () => {
		expect(splitEntry(pair(), 'cable-fly-entry', mint('e'))).toBe(false);
	});

	test('a fresh leg joins with open targets, like any planned exercise', () => {
		const template = pair();

		addExerciseTo(template, 'cable-fly-entry', 'lateral-raise', {
			exercise: 'fresh-node',
			sets: ['fresh-1', 'fresh-2']
		});

		expect(template.entries[0].exercises.map((e) => e.id)).toEqual([
			'cable-fly-node',
			'fresh-node'
		]);
		expect(targetsOf(template, 'fresh-node')).toEqual([null, null]);
	});

	test('zero sets and an unknown entry are both refused', () => {
		const ids = { exercise: 'fresh-node', sets: ['fresh-1'] };

		expect(
			addExerciseTo(pair(), 'cable-fly-entry', 'lateral-raise', { exercise: 'f', sets: [] })
		).toBeNull();
		expect(addExerciseTo(pair(), 'nope', 'lateral-raise', ids)).toBeNull();
	});

	describe('supersetWith', () => {
		const ids = { exercise: 'fresh-node', sets: ['fresh-1'] };

		test('an exercise already planned moves in, targets and all', () => {
			const template = pair();
			setPlannedReps(template, 'lateral-raise-set-1', 15);

			expect(supersetWith(template, 'cable-fly-entry', 'lateral-raise', ids)).toBe(true);
			expect(template.entries).toHaveLength(1);
			expect(targetsOf(template, 'lateral-raise-node')).toEqual([15, null, null]);
		});

		test('an exercise not in the plan is planned fresh, on the minted ids', () => {
			const template = pair();

			expect(supersetWith(template, 'cable-fly-entry', 'pec-deck', ids)).toBe(true);
			expect(template.entries[0].exercises.map((e) => e.id)).toEqual([
				'cable-fly-node',
				'fresh-node'
			]);
			expect(template.entries).toHaveLength(2);
		});

		test('an exercise already in this entry is planned a second time', () => {
			const template = pair();

			expect(supersetWith(template, 'cable-fly-entry', 'cable-fly', ids)).toBe(true);
			expect(template.entries[0].exercises.map((e) => e.id)).toEqual([
				'cable-fly-node',
				'fresh-node'
			]);
		});

		test('an unknown entry is refused', () => {
			expect(supersetWith(pair(), 'nope', 'pec-deck', ids)).toBe(false);
		});
	});

	test('a planned superset starts as a superset', () => {
		const template = pair();
		joinEntry(template, 'cable-fly-entry', 'lateral-raise-node');

		const workout = startFrom(template, 5000, mint('w'));

		expect(workout.entries).toHaveLength(1);
		expect(workout.entries[0].exercises.map((e) => e.exerciseId)).toEqual([
			'cable-fly',
			'lateral-raise'
		]);
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
