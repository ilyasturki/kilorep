import { describe, expect, test } from 'vitest';

import { catalogById } from '$lib/catalog';
import { applyDrift, driftFrom, hasDrift, hasSetDrift, planOffer } from '$lib/domain/drift';
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

const clean: SetDrift = { added: 0, removed: 0, retargeted: 0, grip: null, instead: null };

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

		expect(drift).toEqual({
			matched: { 'w-ex-0': clean },
			unplanned: [],
			missing: [],
			reordered: false,
			regrouped: false
		});
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

		expect(drift.matched['w-ex-0']).toEqual({ ...clean, added: 1 });
		expect(drift.matched['w-ex-1']).toEqual({ ...clean, removed: 1 });
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

		expect(drift.matched['w-ex-0']).toEqual({ ...clean, retargeted: 1 });
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
			plan(['bench', [8]], ['row', [8]], ['bench', [5]]),
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

		expect(drift).toEqual({
			matched: {},
			unplanned: ['w-ex-0'],
			missing: [],
			reordered: false,
			regrouped: false
		});
	});
});

describe('hasSetDrift', () => {
	test('clean is quiet, any count speaks', () => {
		expect(hasSetDrift(clean)).toBe(false);
		expect(hasSetDrift({ ...clean, added: 1 })).toBe(true);
		expect(hasSetDrift({ ...clean, removed: 1 })).toBe(true);
		expect(hasSetDrift({ ...clean, retargeted: 1 })).toBe(true);
		expect(hasSetDrift({ ...clean, grip: 'bar' })).toBe(true);
		expect(hasSetDrift({ ...clean, instead: 'back-squat' })).toBe(true);
	});
});

type Slot = { exerciseId: string; sets: (number | null)[]; optional?: true; grip?: string };

// Ids follow position — `t-x1-0` is the first exercise of the second entry.
function planned(...entries: Slot[][]): Template {
	return {
		id: 'template',
		name: 'Plan',
		createdAt: 0,
		entries: entries.map((exercises, e) => ({
			id: `t-e${e}`,
			exercises: exercises.map(({ sets, ...rest }, x) => ({
				id: `t-x${e}-${x}`,
				...rest,
				sets: sets.map((plannedReps, n) => ({ id: `t-s${e}-${x}-${n}`, plannedReps }))
			}))
		}))
	};
}

type Leg = {
	exerciseId: string;
	sets: number;
	done?: number;
	targets?: (number | null)[];
	optional?: true;
	plannedAs?: string;
	grip?: string;
};

function ran(...entries: Leg[][]): Workout {
	return {
		id: 'workout',
		templateId: 'template',
		startedAt: 0,
		entries: entries.map((legs, e) => ({
			id: `w-e${e}`,
			exercises: legs.map(({ sets, done, targets, ...rest }, x) => ({
				id: `w-x${e}-${x}`,
				...rest,
				sets: Array.from({ length: sets }, (_, n) => {
					const completed = n < (done ?? sets);

					return {
						id: `w-s${e}-${x}-${n}`,
						type: 'normal' as const,
						plannedReps: targets === undefined ? 8 : targets[n],
						weight: completed ? 50 : null,
						reps: completed ? 8 : null,
						rpe: null,
						completed
					};
				})
			}))
		}))
	};
}

const lift = (exerciseId: string, sets = 3, extra: Partial<Leg> = {}): Leg => ({
	exerciseId,
	sets,
	...extra
});

const slot = (exerciseId: string, sets = 3, extra: Partial<Slot> = {}): Slot => ({
	exerciseId,
	sets: Array.from({ length: sets }, () => 8),
	...extra
});

let minted = 0;

const mint = () => `m-${(minted += 1)}`;

function shapeOf(template: Template): string[][] {
	return template.entries.map((entry) => entry.exercises.map((e) => e.exerciseId));
}

function applied(template: Template, workout: Workout, swaps: string[] = []): Template {
	applyDrift(template, workout, known, mint, swaps);

	return template;
}

describe('optional slots', () => {
	test('one dropped from the session is never missing, a required one is', () => {
		const drift = driftFrom(
			ran([lift('bench-press')]),
			planned([slot('bench-press')], [slot('dip', 3, { optional: true })], [slot('cable-fly')]),
			known
		);

		expect(drift.missing).toEqual(['cable-fly']);
	});

	test('one left alone holds its slot and says nothing, whatever became of its sets', () => {
		const drift = driftFrom(
			ran([lift('bench-press')], [lift('dip', 1, { done: 0, optional: true })]),
			planned([slot('bench-press')], [slot('dip', 3, { optional: true })]),
			known
		);

		expect(drift.matched['w-x1-0']).toEqual(clean);
		expect(hasDrift(drift)).toBe(false);
	});
});

describe('a swapped slot', () => {
	test('a stand-in fills the slot it replaced and names it', () => {
		const drift = driftFrom(
			ran([lift('hack-squat', 3, { plannedAs: 'squat' })], [lift('leg-curl')]),
			planned([slot('squat')], [slot('leg-curl')]),
			known
		);

		expect(drift.matched['w-x0-0']).toEqual({ ...clean, instead: 'squat' });
		expect(drift.unplanned).toEqual([]);
		expect(drift.missing).toEqual([]);
		expect(drift.reordered).toBe(false);
	});

	test('the half of a swap that kept its logged sets shares the slot with them', () => {
		const drift = driftFrom(
			ran([lift('squat', 1)], [lift('hack-squat', 2, { plannedAs: 'squat' })]),
			planned([slot('squat')]),
			known
		);

		expect(drift.matched['w-x0-0']).toEqual(clean);
		expect(drift.matched['w-x1-0']).toEqual({ ...clean, instead: 'squat' });
		expect(drift.unplanned).toEqual([]);
	});

	test('dragged above the leg it took over from, it still leaves that leg its slot', () => {
		const drift = driftFrom(
			ran([lift('hack-squat', 2, { plannedAs: 'squat' })], [lift('squat', 1)]),
			planned([slot('squat')]),
			known
		);

		expect(drift.matched['w-x1-0']).toEqual(clean);
		expect(drift.matched['w-x0-0'].instead).toBe('squat');
	});

	test('with no slot left for what it replaced, it is matched as itself', () => {
		const drift = driftFrom(
			ran([lift('hack-squat', 3, { plannedAs: 'squat' })]),
			planned([slot('hack-squat')]),
			known
		);

		expect(drift.matched['w-x0-0']).toEqual(clean);
	});
});

describe('order and supersets', () => {
	test('planned exercises taken in another order are a reorder', () => {
		const drift = driftFrom(
			ran([lift('cable-fly')], [lift('bench-press')]),
			planned([slot('bench-press')], [slot('cable-fly')]),
			known
		);

		expect(drift).toMatchObject({ reordered: true, regrouped: false });
		expect(hasDrift(drift)).toBe(true);
	});

	test('two planned exercises supersetted, or a superset broken, regroup', () => {
		const joined = driftFrom(
			ran([lift('bench-press'), lift('cable-fly')]),
			planned([slot('bench-press')], [slot('cable-fly')]),
			known
		);
		const broken = driftFrom(
			ran([lift('bench-press')], [lift('cable-fly')]),
			planned([slot('bench-press'), slot('cable-fly')]),
			known
		);

		expect(joined).toMatchObject({ reordered: false, regrouped: true });
		expect(broken).toMatchObject({ reordered: false, regrouped: true });
	});

	test('an exercise added or dropped moves nothing else', () => {
		const drift = driftFrom(
			ran([lift('bench-press'), lift('dip')], [lift('pec-deck')]),
			planned([slot('bench-press')], [slot('cable-fly')], [slot('pec-deck')]),
			known
		);

		expect(drift).toMatchObject({ reordered: false, regrouped: false });
	});
});

describe('planOffer', () => {
	test('every kind of drift is offered, and a moved target is not', () => {
		const offer = planOffer(
			planned(
				[slot('leg-press')],
				[slot('leg-curl', 3)],
				[slot('triceps-pushdown', 3, { grip: 'rope' })],
				[slot('standing-calf-raise')]
			),
			ran(
				[lift('leg-press', 4)],
				[lift('leg-curl', 3, { targets: [10, 10, 10] })],
				[lift('triceps-pushdown', 3, { grip: 'bar' })],
				[lift('cable-crunch')]
			),
			known
		);

		expect(offer).toEqual({
			changes: [
				{ kind: 'sets', exerciseId: 'leg-press', from: 3, to: 4 },
				{ kind: 'grip', exerciseId: 'triceps-pushdown', grip: 'bar' },
				{ kind: 'added', exerciseId: 'cable-crunch' },
				{ kind: 'removed', exerciseId: 'standing-calf-raise' }
			],
			swaps: []
		});
	});

	test('a session that followed the plan offers nothing', () => {
		expect(planOffer(planned([slot('bench-press')]), ran([lift('bench-press')]), known)).toEqual({
			changes: [],
			swaps: []
		});
	});

	test('an exercise added and never lifted is not offered', () => {
		const offer = planOffer(
			planned([slot('bench-press')]),
			ran([lift('bench-press')], [lift('dip', 3, { done: 0 })]),
			known
		);

		expect(offer.changes).toEqual([]);
	});

	test('an optional exercise skipped or dropped is never offered for removal', () => {
		const plan = planned(
			[slot('bench-press')],
			[slot('dip', 3, { optional: true })],
			[slot('cable-fly', 3, { optional: true })]
		);

		const offer = planOffer(
			plan,
			ran([lift('bench-press')], [lift('dip', 2, { done: 0, optional: true })]),
			known
		);

		expect(offer).toEqual({ changes: [], swaps: [] });
	});

	test('a swap is offered as a swap, never as one removed and one added', () => {
		const offer = planOffer(
			planned([slot('squat')], [slot('leg-curl')]),
			ran([lift('hack-squat', 4, { plannedAs: 'squat' })], [lift('leg-curl')]),
			known
		);

		expect(offer).toEqual({
			changes: [],
			swaps: [{ legId: 'w-x0-0', from: 'squat', to: 'hack-squat' }]
		});
	});

	test('a swap that kept its logged sets swaps nothing in the plan, and its sets count together', () => {
		const offer = planOffer(
			planned([slot('squat')]),
			ran([lift('squat', 1)], [lift('hack-squat', 3, { plannedAs: 'squat' })]),
			known
		);

		expect(offer).toEqual({
			changes: [{ kind: 'sets', exerciseId: 'squat', from: 3, to: 4 }],
			swaps: []
		});
	});

	test('a new order and new supersets are offered', () => {
		const offer = planOffer(
			planned([slot('bench-press')], [slot('cable-fly')], [slot('pec-deck')]),
			ran([lift('cable-fly'), lift('pec-deck')], [lift('bench-press')]),
			known
		);

		expect(offer.changes).toEqual([{ kind: 'order' }, { kind: 'supersets' }]);
	});
});

describe('applyDrift', () => {
	test('a session that followed the plan leaves it exactly as it was', () => {
		const plan = planned([slot('bench-press'), slot('cable-fly')], [slot('dip')]);
		const before = structuredClone(plan);

		expect(applied(plan, ran([lift('bench-press'), lift('cable-fly')], [lift('dip')]))).toEqual(
			before
		);
	});

	test('a set added repeats the last target, a set dropped goes off the end', () => {
		const plan = planned(
			[{ exerciseId: 'bench-press', sets: [10, 8, 6] }],
			[{ exerciseId: 'leg-curl', sets: [12, 10, 10] }]
		);

		applied(plan, ran([lift('bench-press', 4)], [lift('leg-curl', 2)]));

		expect(plan.entries[0].exercises[0].sets.map((set) => set.plannedReps)).toEqual([
			10, 8, 6, 6
		]);
		expect(plan.entries[1].exercises[0].sets.map((set) => set.id)).toEqual([
			't-s1-0-0',
			't-s1-0-1'
		]);
	});

	test('rep targets are never read back out of the session', () => {
		const plan = planned([{ exerciseId: 'leg-curl', sets: [12, 12, 12] }]);

		applied(plan, ran([lift('leg-curl', 3, { targets: [10, 10, 10] })]));

		expect(plan.entries[0].exercises[0].sets.map((set) => set.plannedReps)).toEqual([12, 12, 12]);
	});

	test('the grip the session settled on becomes the prescription', () => {
		const plan = planned([slot('triceps-pushdown', 3, { grip: 'rope' })]);

		applied(plan, ran([lift('triceps-pushdown', 3, { grip: 'bar' })]));

		expect(plan.entries[0].exercises[0].grip).toBe('bar');
	});

	test('an added exercise lands where the session did it, open targets and no weight', () => {
		const plan = planned([slot('bench-press')], [slot('pec-deck')]);

		applied(
			plan,
			ran(
				[lift('bench-press')],
				[lift('dip', 2, { targets: [null, null] })],
				[lift('pec-deck'), lift('cable-fly')]
			)
		);

		expect(shapeOf(plan)).toEqual([['bench-press'], ['dip'], ['pec-deck', 'cable-fly']]);
		expect(plan.entries[1].exercises[0].sets.map((set) => set.plannedReps)).toEqual([null, null]);
		expect(JSON.stringify(plan)).not.toMatch(/weight|"reps"|completed/u);
	});

	test('a required exercise dropped from the session leaves the plan', () => {
		const plan = planned([slot('bench-press')], [slot('cable-fly')]);

		applied(plan, ran([lift('bench-press')]));

		expect(shapeOf(plan)).toEqual([['bench-press']]);
	});

	test('the order and the supersets come across, every surviving id unique', () => {
		const plan = planned(
			[slot('bench-press'), slot('cable-fly')],
			[slot('dip')],
			[slot('pec-deck')]
		);

		applied(
			plan,
			ran([lift('pec-deck'), lift('dip')], [lift('bench-press')], [lift('cable-fly')])
		);

		expect(shapeOf(plan)).toEqual([['pec-deck', 'dip'], ['bench-press'], ['cable-fly']]);

		const ids = plan.entries.flatMap((entry) => [
			entry.id,
			...entry.exercises.flatMap((e) => [e.id, ...e.sets.map((set) => set.id)])
		]);

		expect(new Set(ids).size).toBe(ids.length);
	});

	test('ids, and keys this build does not know, survive on everything kept', () => {
		const plan = planned([slot('bench-press', 2)], [slot('cable-fly')]);
		const future = { 'future-key': { nested: [1, 2] } };

		Object.assign(plan.entries[0], future);
		Object.assign(plan.entries[0].exercises[0], future);
		Object.assign(plan.entries[0].exercises[0].sets[0], future);

		applied(plan, ran([lift('dip')], [lift('bench-press', 3)], [lift('cable-fly')]));

		const bench = plan.entries[1];

		expect(bench).toMatchObject({ id: 't-e0', ...future });
		expect(bench.exercises[0]).toMatchObject({ id: 't-x0-0', ...future });
		expect(bench.exercises[0].sets[0]).toMatchObject({ id: 't-s0-0-0', ...future });
		expect(plan.entries[2].id).toBe('t-e1');
	});

	test('an optional exercise left alone is left alone, and one dropped stays where it was', () => {
		const plan = planned(
			[slot('bench-press')],
			[slot('dip', 3, { optional: true })],
			[slot('cable-fly')],
			[slot('pec-deck', 2, { optional: true })]
		);
		const before = structuredClone(plan);

		applied(
			plan,
			ran(
				[lift('bench-press')],
				[lift('dip', 1, { done: 0, optional: true })],
				[lift('cable-fly')]
			)
		);

		expect(plan).toEqual(before);
	});

	test('a swap changes nothing unless it is asked for', () => {
		const plan = planned([slot('squat')], [slot('leg-curl')]);
		const before = structuredClone(plan);
		const workout = ran([lift('hack-squat', 4, { plannedAs: 'squat' })], [lift('leg-curl')]);

		expect(applied(plan, workout)).toEqual(before);
	});

	test('asked for, the slot takes the stand-in in place, sets and all', () => {
		const plan = planned([slot('triceps-pushdown', 3, { grip: 'bar' })], [slot('leg-curl')]);
		const workout = ran([lift('dip', 4, { plannedAs: 'triceps-pushdown' })], [lift('leg-curl')]);

		applied(plan, workout, ['w-x0-0']);

		expect(plan.entries[0].exercises[0]).toMatchObject({ id: 't-x0-0', exerciseId: 'dip' });
		expect('grip' in plan.entries[0].exercises[0]).toBe(false);
		expect(plan.entries[0].exercises[0].sets).toHaveLength(4);
	});

	test('a stand-in worked on a stated grip brings it along', () => {
		const plan = planned([slot('squat')]);
		const workout = ran([lift('triceps-pushdown', 3, { plannedAs: 'squat', grip: 'v-bar' })]);

		applied(plan, workout, ['w-x0-0']);

		expect(plan.entries[0].exercises[0].grip).toBe('v-bar');
	});

	test('once applied, the same session offers nothing more', () => {
		const plan = planned([slot('bench-press')], [slot('cable-fly')], [slot('squat')]);
		const workout = ran(
			[lift('cable-fly', 4), lift('dip')],
			[lift('bench-press')],
			[lift('hack-squat', 3, { plannedAs: 'squat' })]
		);

		applied(plan, workout, ['w-x2-0']);

		expect(planOffer(plan, workout, known)).toEqual({ changes: [], swaps: [] });
	});
});
