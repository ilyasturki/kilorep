import { describe, expect, test } from 'vitest';

import { catalogById } from '$lib/catalog';
import { driftFrom, hasDrift, hasSetDrift } from '$lib/domain/drift';
import type { SetDrift } from '$lib/domain/drift';
import type { Exercise } from '$lib/domain/exercise';
import type { Template } from '$lib/domain/template';
import type { SetType, Workout } from '$lib/domain/workout';

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
						rpe: null,
						completed: true
					}))
				}
			]
		}))
	};
}

const clean: SetDrift = { added: 0, removed: 0, retargeted: 0, grip: null };

// The real entries, so the axis a drift is judged against is the one the app would read.
const known = (id: string): Exercise | undefined => catalogById[id];

function gripped(planned: string | undefined, performed: string | undefined): SetDrift {
	const template = plan(['triceps-pushdown', [8]]);
	const workout = session(['triceps-pushdown', [8]]);

	template.entries[0].exercises[0].grip = planned;
	workout.entries[0].exercises[0].grip = performed;

	return driftFrom(workout, template, known).matched['w-ex-0'];
}

describe('grip drift', () => {
	test('reaching for another handle than the plan asked for is a deviation', () => {
		expect(gripped('rope', 'bar').grip).toBe('bar');
	});

	test('and matching it is not, however either side spells the default', () => {
		const unstated: string | undefined = undefined;

		expect(gripped('rope', 'rope').grip).toBeNull();
		expect(gripped(unstated, 'rope').grip).toBeNull();
		expect(gripped('rope', unstated).grip).toBeNull();
	});
});

describe('driftFrom', () => {
	test('a session that followed the plan drifts nowhere', () => {
		const drift = driftFrom(session(['bench', [8, 8, 8]]), plan(['bench', [8, 8, 8]]), known);

		expect(drift).toEqual({ matched: { 'w-ex-0': clean }, unplanned: [], missing: [] });
		expect(hasDrift(drift)).toBe(false);
	});

	test('an exercise the plan never held is unplanned', () => {
		const drift = driftFrom(session(['bench', [8]], ['curl', [null]]), plan(['bench', [8]]), known);

		expect(drift.unplanned).toEqual(['w-ex-1']);
		expect(hasDrift(drift)).toBe(true);
	});

	test('a planned exercise never performed is missing, in plan order', () => {
		const drift = driftFrom(
			session(['row', [8]]),
			plan(['bench', [8]], ['row', [8]], ['curl', [12]]),
			known
		);

		expect(drift.missing).toEqual(['bench', 'curl']);
	});

	test('extra and dropped working sets count against the plan slot', () => {
		const drift = driftFrom(
			session(['bench', [8, 8, 8, null]], ['row', [8]]),
			plan(['bench', [8, 8, 8]], ['row', [8, 8]]),
			known
		);

		expect(drift.matched['w-ex-0']).toEqual({ added: 1, removed: 0, retargeted: 0, grip: null });
		expect(drift.matched['w-ex-1']).toEqual({ added: 0, removed: 1, retargeted: 0, grip: null });
	});

	test('warmups occupy no plan slot', () => {
		const drift = driftFrom(
			session(['bench', [null, 8, 8, 8], ['warmup', 'normal', 'normal', 'normal']]),
			plan(['bench', [8, 8, 8]]),
			known
		);

		expect(drift.matched['w-ex-0']).toEqual(clean);
	});

	test('a moved rep target is retargeted, position by position', () => {
		const drift = driftFrom(
			session(['bench', [8, 8, null]]),
			plan(['bench', [8, 10, null]]),
			known
		);

		expect(drift.matched['w-ex-0']).toEqual({ added: 0, removed: 0, retargeted: 1, grip: null });
	});

	test('an uncompleted working set still holds its slot', () => {
		const workout = session(['bench', [8, 8]]);
		workout.entries[0].exercises[0].sets[1].completed = false;
		workout.entries[0].exercises[0].sets[1].weight = null;
		workout.entries[0].exercises[0].sets[1].reps = null;

		expect(driftFrom(workout, plan(['bench', [8, 8]]), known).matched['w-ex-0']).toEqual(clean);
	});

	test('doing an exercise twice matches its plan slots by occurrence', () => {
		const drift = driftFrom(
			session(['bench', [8]], ['row', [8]], ['bench', [5]]),
			plan(['bench', [8]], ['bench', [5]], ['row', [8]]),
			known
		);

		expect(drift.matched['w-ex-0']).toEqual(clean);
		expect(drift.matched['w-ex-2']).toEqual(clean);
		expect(drift.unplanned).toEqual([]);
		expect(drift.missing).toEqual([]);
		expect(hasDrift(drift)).toBe(false);
	});

	test('a second performance beyond the plan is unplanned, not a rematch', () => {
		const drift = driftFrom(session(['bench', [8]], ['bench', [8]]), plan(['bench', [8]]), known);

		expect(drift.matched['w-ex-0']).toEqual(clean);
		expect(drift.unplanned).toEqual(['w-ex-1']);
	});

	test('an empty plan makes every exercise unplanned', () => {
		const drift = driftFrom(session(['bench', [8]]), plan(), known);

		expect(drift).toEqual({ matched: {}, unplanned: ['w-ex-0'], missing: [] });
	});
});

describe('hasSetDrift', () => {
	test('clean is quiet, any count speaks', () => {
		expect(hasSetDrift(clean)).toBe(false);
		expect(hasSetDrift({ added: 1, removed: 0, retargeted: 0, grip: null })).toBe(true);
		expect(hasSetDrift({ added: 0, removed: 1, retargeted: 0, grip: null })).toBe(true);
		expect(hasSetDrift({ added: 0, removed: 0, retargeted: 1, grip: null })).toBe(true);
		expect(hasSetDrift({ added: 0, removed: 0, retargeted: 0, grip: 'bar' })).toBe(true);
	});
});
