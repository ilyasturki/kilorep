import { describe, expect, test } from 'vitest';

import { MAX_REST_SECONDS, MIN_REST_SECONDS } from '$lib/domain/rest';
import {
	addExercise,
	addExerciseTo,
	addSet,
	blankTemplate,
	byRank,
	drawableMark,
	isArchived,
	isBlank,
	joinEntry,
	moveEntry,
	moveExercise,
	removeExercise,
	removeSet,
	reorder,
	replaceExercise,
	setExerciseReps,
	setExerciseRest,
	setPlannedReps,
	splitEntry,
	templateRank,
	startFrom,
	supersetWith
} from '$lib/domain/template';
import type { Template, TemplateMark } from '$lib/domain/template';

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

	test('a leg trades places with the one beside it', () => {
		const template = pair();
		joinEntry(template, 'cable-fly-entry', 'lateral-raise-node');

		expect(moveExercise(template, 'lateral-raise-node', -1)).toBe(true);
		expect(orderOf(template)).toEqual(['lateral-raise', 'cable-fly']);

		expect(moveExercise(template, 'lateral-raise-node', 1)).toBe(true);
		expect(orderOf(template)).toEqual(['cable-fly', 'lateral-raise']);
	});

	test('the targets ride along with the leg', () => {
		const template = pair();
		setPlannedReps(template, 'lateral-raise-set-1', 15);
		joinEntry(template, 'cable-fly-entry', 'lateral-raise-node');

		moveExercise(template, 'lateral-raise-node', -1);

		expect(targetsOf(template, 'lateral-raise-node')).toEqual([15, null, null]);
	});

	test('the ends of an entry refuse rather than wrapping', () => {
		const template = pair();
		joinEntry(template, 'cable-fly-entry', 'lateral-raise-node');

		expect(moveExercise(template, 'cable-fly-node', -1)).toBe(false);
		expect(moveExercise(template, 'lateral-raise-node', 1)).toBe(false);
		expect(orderOf(template)).toEqual(['cable-fly', 'lateral-raise']);
	});

	test('a leg never leaves its own entry, and an unknown one is refused', () => {
		const template = pair();

		// Two entries of one leg each: the swap has no neighbour to trade with
		// inside its entry, and the exercise standing beside it is not one.
		expect(moveExercise(template, 'cable-fly-node', 1)).toBe(false);
		expect(moveExercise(template, 'nope', -1)).toBe(false);
		expect(orderOf(template)).toEqual(['cable-fly', 'lateral-raise']);
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

function restOf(template: Template): number | null | undefined {
	return template.entries[0].exercises[0].restSeconds;
}

describe('planned rest', () => {
	function withBench(): Template {
		const template = blankTemplate('t1', 100);
		plan(template, 'bench-press', 3);

		return template;
	}

	test('a fresh exercise plans no rest of its own', () => {
		expect(restOf(withBench())).toBeUndefined();
	});

	test('a duration is settled the way every other rest field is', () => {
		const template = withBench();

		setExerciseRest(template, 'bench-press-node', 5);
		expect(restOf(template)).toBe(MIN_REST_SECONDS);

		setExerciseRest(template, 'bench-press-node', 5000);
		expect(restOf(template)).toBe(MAX_REST_SECONDS);
	});

	test('null is never-rest and survives as itself', () => {
		const template = withBench();

		setExerciseRest(template, 'bench-press-node', null);

		expect(restOf(template)).toBeNull();
	});

	test('undefined takes the key away rather than writing an empty one', () => {
		const template = withBench();

		setExerciseRest(template, 'bench-press-node', 180);
		setExerciseRest(template, 'bench-press-node', undefined);

		expect('restSeconds' in template.entries[0].exercises[0]).toBe(false);
	});

	test('an exercise that is not in the plan refuses', () => {
		expect(setExerciseRest(withBench(), 'no-such-node', 180)).toBe(false);
	});

	test('a swap keeps the rest, as it keeps the sets and the targets', () => {
		const template = withBench();

		setExerciseRest(template, 'bench-press-node', 180);
		replaceExercise(template, 'bench-press-node', 'incline-bench-press');

		expect(restOf(template)).toBe(180);
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

	test("the plan's rest durations ride into the session", () => {
		const template = pushDay();
		setExerciseRest(template, 'bench-press-node', 195);
		setExerciseRest(template, 'cable-fly-node', null);

		const workout = startFrom(template, 5000, mint('w'));
		const exercises = workout.entries.flatMap((e) => e.exercises);

		expect(exercises.map((e) => e.restSeconds)).toEqual([195, null]);
	});

	test('an exercise with no planned rest carries no key at all into the session', () => {
		const workout = startFrom(pushDay(), 5000, mint('w'));

		expect('restSeconds' in workout.entries[0].exercises[0]).toBe(false);
	});

	test('an empty template starts an empty workout', () => {
		const workout = startFrom(blankTemplate('t9', 100), 5000, mint('w'));

		expect(workout.entries).toEqual([]);
		expect(workout.templateId).toBe('t9');
	});
});

function at(id: string, createdAt: number, order?: number): Template {
	const template = blankTemplate(id, createdAt);

	template.order = order;

	return template;
}

function list(): Template[] {
	return [blankTemplate('a', 100), blankTemplate('b', 200), blankTemplate('c', 300)];
}

function applied(templates: Template[], id: string, index: number): string[] {
	const order = reorder(templates, id, index);
	const moved = templates.find((t) => t.id === id);

	if (moved === undefined || order === null) {
		throw new Error('the drag under test did not move anything');
	}

	moved.order = order;

	return templates.toSorted(byRank).map((t) => t.id);
}

describe('rank', () => {
	test('an undragged template ranks by its birthday', () => {
		expect(templateRank(at('t1', 100))).toBe(100);
	});

	test('order and createdAt sort on one number line', () => {
		const mixed = [at('c', 300), at('a', 100, 50), at('b', 200)];

		expect(mixed.toSorted(byRank).map((t) => t.id)).toEqual(['a', 'b', 'c']);
	});

	test('an order of zero is a placement, not an absence', () => {
		expect(templateRank(at('t1', 100, 0))).toBe(0);
	});
});

describe('reorder', () => {
	test('moving down lands between the new neighbours', () => {
		expect(applied(list(), 'a', 1)).toEqual(['b', 'a', 'c']);
	});

	test('moving up lands between the new neighbours', () => {
		expect(applied(list(), 'c', 1)).toEqual(['a', 'c', 'b']);
	});

	test('the index means the same thing in both directions', () => {
		expect(applied(list(), 'a', 2)).toEqual(['b', 'c', 'a']);
		expect(applied(list(), 'c', 0)).toEqual(['c', 'a', 'b']);
	});

	test('a drop where it already sits writes nothing', () => {
		expect(reorder(list(), 'b', 1)).toBeNull();
	});

	test('an unknown id writes nothing', () => {
		expect(reorder(list(), 'zz', 0)).toBeNull();
	});

	test('an out-of-range index writes nothing', () => {
		expect(reorder(list(), 'a', 3)).toBeNull();
		expect(reorder(list(), 'a', -1)).toBeNull();
	});

	test('repeated drags into the same gap keep their order', () => {
		let templates = list();

		// Halving the same gap again and again is the known cost of writing one
		// record per drag. Always dragging whichever card is currently on top
		// into the middle is what actually walks the gap down — dragging the same
		// card twice is a no-op the second time, which the guard already answers.
		for (let i = 0; i < 40; i += 1) {
			const top = templates[0];
			const order = reorder(templates, top.id, 1);

			if (order === null) {
				throw new Error('dragging the top card into the middle is never a no-op');
			}

			top.order = order;
			templates = templates.toSorted(byRank);
		}

		const ranks = templates.map((t) => templateRank(t));
		const last = templates.at(-1);

		expect(new Set(ranks).size).toBe(3);
		expect(ranks).toEqual(ranks.toSorted((a, b) => a - b));
		expect(last === undefined ? null : last.id).toBe('c');
	});
});

function archivedAt(stamp: number | null): Template {
	const template = blankTemplate('t1', 100);

	template.archivedAt = stamp;

	return template;
}

describe('archive', () => {
	test('a fresh template is not archived', () => {
		expect(isArchived(blankTemplate('t1', 100))).toBe(false);
	});

	test('a null archivedAt is not archived', () => {
		expect(isArchived(archivedAt(null))).toBe(false);
	});

	test('a stamped archivedAt is archived', () => {
		expect(isArchived(archivedAt(500))).toBe(true);
	});

	test('archiving at epoch zero still counts as archived', () => {
		expect(isArchived(archivedAt(0))).toBe(true);
	});
});

function marked(icon: string, colour: string): Template {
	const template = blankTemplate('t1', 100);

	template.mark = { icon, colour } as unknown as TemplateMark;

	return template;
}

describe('drawableMark', () => {
	test('an unmarked template draws nothing', () => {
		const cleared = blankTemplate('t1', 100);

		cleared.mark = null;

		expect(drawableMark(blankTemplate('t1', 100))).toBeNull();
		expect(drawableMark(cleared)).toBeNull();
	});

	test('a known mark draws', () => {
		expect(drawableMark(marked('push', 'blue'))).toEqual({ icon: 'push', colour: 'blue' });
	});

	test('a glyph this build does not know draws nothing', () => {
		const template = marked('hinge', 'blue');

		expect(drawableMark(template)).toBeNull();
		expect(template.mark).not.toBeNull();
	});

	test('a hue this build does not know draws nothing', () => {
		expect(drawableMark(marked('push', 'chartreuse'))).toBeNull();
	});
});
