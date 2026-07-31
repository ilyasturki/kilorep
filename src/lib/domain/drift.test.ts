import { describe, expect, test } from 'vitest';

import { driftFrom, hasDrift, hasSetDrift } from '$lib/domain/drift';
import type { SetDrift } from '$lib/domain/drift';
import type { Template } from '$lib/domain/template';
import type { SetType, Workout } from '$lib/domain/workout';

/**
 * The diff that has no screen to check it: a wrong match reads as a plausible
 * badge on a plausible row. Matching is by catalog exercise and occurrence
 * order, never by node id — the ids were re-minted at start and agreeing ids
 * here would be a broken fixture, so the builders mint disjoint ones.
 */

type PlannedShape = [exerciseId: string, targets: (number | null)[]];

function plan(...exercises: PlannedShape[]): Template {
	return {
		id: 'template',
		name: 'Plan',
		createdAt: 0,
		entries: exercises.map(([exerciseId, targets], entry) => ({
			id: `t-entry-${entry}`,
			exercises: [
				{
					id: `t-ex-${entry}`,
					exerciseId,
					sets: targets.map((plannedReps, set) => ({ id: `t-set-${entry}-${set}`, plannedReps }))
				}
			]
		}))
	};
}

type PerformedShape = [exerciseId: string, targets: (number | null)[], types?: SetType[]];

function session(...exercises: PerformedShape[]): Workout {
	return {
		id: 'workout',
		templateId: 'template',
		startedAt: 0,
		entries: exercises.map(([exerciseId, targets, types], entry) => ({
			id: `w-entry-${entry}`,
			exercises: [
				{
					id: `w-ex-${entry}`,
					exerciseId,
					sets: targets.map((plannedReps, set) => ({
						id: `w-set-${entry}-${set}`,
						type: types === undefined ? 'normal' : (types[set] ?? 'normal'),
						plannedReps,
						weight: 100,
						reps: 5,
						completed: true
					}))
				}
			]
		}))
	};
}

const clean: SetDrift = { added: 0, removed: 0, retargeted: 0 };

describe('driftFrom', () => {
	test('a session that followed the plan drifts nowhere', () => {
		const drift = driftFrom(session(['bench', [8, 8, 8]]), plan(['bench', [8, 8, 8]]));

		expect(drift).toEqual({ matched: { 'w-ex-0': clean }, unplanned: [], missing: [] });
		expect(hasDrift(drift)).toBe(false);
	});

	test('an exercise the plan never held is unplanned', () => {
		const drift = driftFrom(session(['bench', [8]], ['curl', [null]]), plan(['bench', [8]]));

		expect(drift.unplanned).toEqual(['w-ex-1']);
		expect(hasDrift(drift)).toBe(true);
	});

	test('a planned exercise never performed is missing, in plan order', () => {
		const drift = driftFrom(
			session(['row', [8]]),
			plan(['bench', [8]], ['row', [8]], ['curl', [12]])
		);

		expect(drift.missing).toEqual(['bench', 'curl']);
	});

	test('extra and dropped working sets count against the plan slot', () => {
		const drift = driftFrom(
			session(['bench', [8, 8, 8, null]], ['row', [8]]),
			plan(['bench', [8, 8, 8]], ['row', [8, 8]])
		);

		expect(drift.matched['w-ex-0']).toEqual({ added: 1, removed: 0, retargeted: 0 });
		expect(drift.matched['w-ex-1']).toEqual({ added: 0, removed: 1, retargeted: 0 });
	});

	test('warmups occupy no plan slot', () => {
		const drift = driftFrom(
			session(['bench', [null, 8, 8, 8], ['warmup', 'normal', 'normal', 'normal']]),
			plan(['bench', [8, 8, 8]])
		);

		expect(drift.matched['w-ex-0']).toEqual(clean);
	});

	test('a moved rep target is retargeted, position by position', () => {
		const drift = driftFrom(session(['bench', [8, 8, null]]), plan(['bench', [8, 10, null]]));

		expect(drift.matched['w-ex-0']).toEqual({ added: 0, removed: 0, retargeted: 1 });
	});

	test('an uncompleted working set still holds its slot', () => {
		const workout = session(['bench', [8, 8]]);
		workout.entries[0].exercises[0].sets[1].completed = false;
		workout.entries[0].exercises[0].sets[1].weight = null;
		workout.entries[0].exercises[0].sets[1].reps = null;

		expect(driftFrom(workout, plan(['bench', [8, 8]])).matched['w-ex-0']).toEqual(clean);
	});

	test('doing an exercise twice matches its plan slots by occurrence', () => {
		const drift = driftFrom(
			session(['bench', [8]], ['row', [8]], ['bench', [5]]),
			plan(['bench', [8]], ['bench', [5]], ['row', [8]])
		);

		expect(drift.matched['w-ex-0']).toEqual(clean);
		expect(drift.matched['w-ex-2']).toEqual(clean);
		expect(drift.unplanned).toEqual([]);
		expect(drift.missing).toEqual([]);
		expect(hasDrift(drift)).toBe(false);
	});

	test('a second performance beyond the plan is unplanned, not a rematch', () => {
		const drift = driftFrom(session(['bench', [8]], ['bench', [8]]), plan(['bench', [8]]));

		expect(drift.matched['w-ex-0']).toEqual(clean);
		expect(drift.unplanned).toEqual(['w-ex-1']);
	});

	test('an empty plan makes every exercise unplanned', () => {
		const drift = driftFrom(session(['bench', [8]]), plan());

		expect(drift).toEqual({ matched: {}, unplanned: ['w-ex-0'], missing: [] });
	});
});

describe('hasSetDrift', () => {
	test('clean is quiet, any count speaks', () => {
		expect(hasSetDrift(clean)).toBe(false);
		expect(hasSetDrift({ added: 1, removed: 0, retargeted: 0 })).toBe(true);
		expect(hasSetDrift({ added: 0, removed: 1, retargeted: 0 })).toBe(true);
		expect(hasSetDrift({ added: 0, removed: 0, retargeted: 1 })).toBe(true);
	});
});
