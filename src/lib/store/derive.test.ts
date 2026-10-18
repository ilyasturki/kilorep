import { describe, expect, it } from 'vitest';

import { rawPr } from '$lib/domain/stats';
import type { WorkoutEntry, WorkoutExercise, WorkoutSet } from '$lib/domain/workout';

import type { FinishedWorkout } from './derive.ts';
import {
	frequentFrom,
	heaviestFrom,
	historyFrom,
	lastGripsFrom,
	lastPerformedFrom,
	narrowTo,
	pastSessionsFrom,
	sessionsByExercise
} from './derive.ts';
import { foldWorkout } from './fold.ts';

type Logged = { weight: number; reps: number; grip?: string; type?: WorkoutSet['type'] };

let minted = 0;

const id = (): string => `id-${(minted += 1)}`;

function leg(exerciseId: string, sets: Logged[], grip?: string): WorkoutEntry {
	const exercise: WorkoutExercise = {
		id: id(),
		exerciseId,
		sets: sets.map((set) => {
			const logged: WorkoutSet = {
				id: id(),
				type: set.type ?? 'normal',
				plannedReps: null,
				weight: set.weight,
				reps: set.reps,
				rpe: null,
				completed: true
			};

			if (set.grip !== undefined) {
				logged.grip = set.grip;
			}

			return logged;
		})
	};

	if (grip !== undefined) {
		exercise.grip = grip;
	}

	return { id: id(), exercises: [exercise] };
}

function workout(startedAt: number, ...entries: WorkoutEntry[]): FinishedWorkout {
	return { id: `w-${startedAt}`, templateId: null, startedAt, entries, finishedAt: startedAt + 1 };
}

const only = (sets: { weight: number; reps: number }[]): number[] => sets.map((set) => set.weight);

const grips = (sets: { grip?: string }[]): (string | undefined)[] => sets.map((set) => set.grip);

describe('history across grips', () => {
	const both = [
		workout(
			100,
			leg('squat', [{ weight: 100, reps: 5 }]),
			leg('triceps-pushdown', [
				{ weight: 30, reps: 12, grip: 'rope' },
				{ weight: 40, reps: 8, grip: 'bar' }
			])
		)
	];

	it('keeps every grip in one session of the exercise, each set saying which it was', () => {
		const [session] = sessionsByExercise(both)['triceps-pushdown'];

		expect(only(session.sets)).toEqual([30, 40]);
		expect(grips(session.sets)).toEqual(['rope', 'bar']);
		expect(session.position).toBe(2);
	});

	it('names the default on a set logged before the axis existed, and nothing where there is none', () => {
		const sessions = sessionsByExercise([
			workout(100, leg('triceps-pushdown', [{ weight: 30, reps: 12 }])),
			workout(200, leg('squat', [{ weight: 100, reps: 5 }]))
		]);

		expect(grips(sessions['triceps-pushdown'][0].sets)).toEqual(['rope']);
		expect(Object.hasOwn(sessions.squat[0].sets[0], 'grip')).toBe(false);
	});

	it('reads one exercise on the shelf and in recency, not one per grip', () => {
		expect(frequentFrom(both).toSorted()).toEqual(['squat', 'triceps-pushdown']);
		expect(only(lastPerformedFrom(both)['triceps-pushdown']!.sets)).toEqual([30, 40]);
	});
});

describe('historyFrom', () => {
	it('recalls the exercise’s last session whatever the grip it was done with', () => {
		const history = historyFrom([
			workout(100, leg('pull-up', [{ weight: 0, reps: 8, grip: 'overhand' }])),
			workout(200, leg('pull-up', [{ weight: 0, reps: 10, grip: 'underhand' }]))
		]);

		expect(history['pull-up']).toEqual([{ weight: 0, reps: 10, rpe: null, grip: 'underhand' }]);
		expect(history['pull-up#underhand']).toBeUndefined();
	});
});

describe('bests across grips', () => {
	const pulls = [
		workout(100, leg('pull-up', [{ weight: 10, reps: 6, grip: 'underhand' }])),
		workout(200, leg('pull-up', [{ weight: 12.5, reps: 3, grip: 'overhand' }])),
		workout(300, leg('pull-up', [{ weight: 5, reps: 8, grip: 'neutral' }]))
	];

	it('rank every grip together on the ledger and the picker', () => {
		expect(heaviestFrom(pulls)['pull-up']).toMatchObject({ weight: 12.5, reps: 3 });
	});

	it('are the same set the exercise screen’s raw best finds', () => {
		const pr = rawPr(pastSessionsFrom(pulls, 'pull-up'), () => 80);

		expect(pr).toMatchObject({ set: { weight: 12.5, reps: 3 }, date: 200, load: 92.5 });
	});
});

describe('narrowTo', () => {
	const mixed = [
		workout(
			100,
			leg('pull-up', [
				{ weight: 0, reps: 10, grip: 'overhand' },
				{ weight: 0, reps: 12, grip: 'underhand' }
			])
		),
		workout(200, leg('pull-up', [{ weight: 0, reps: 9, grip: 'overhand' }]))
	];

	const all = pastSessionsFrom(mixed, 'pull-up');

	it('keeps one grip’s sets and drops the sessions that had none', () => {
		const underhand = narrowTo(all, 'underhand');

		expect(underhand).toHaveLength(1);
		expect(underhand[0]).toMatchObject({ date: 100, position: 1 });
		expect(underhand[0].sets.map((set) => set.reps)).toEqual([12]);
		expect(narrowTo(all, 'neutral')).toEqual([]);
	});

	it('hands back the very sets it was given, so a best found in it matches its row', () => {
		const overhand = narrowTo(all, 'overhand');

		expect(overhand[0].sets[0]).toBe(all[0].sets[0]);
		expect(rawPr(overhand, () => 0)!.set).toBe(all[0].sets[0]);
	});
});

describe('lastGripsFrom', () => {
	it('remembers what the exercise was last worked with, so an insert opens on it', () => {
		const last = lastGripsFrom([
			workout(100, leg('triceps-pushdown', [{ weight: 40, reps: 8, grip: 'bar' }], 'bar')),
			workout(200, leg('triceps-pushdown', [{ weight: 32.5, reps: 12, grip: 'v-bar' }], 'v-bar'))
		]);

		expect(last['triceps-pushdown']).toBe('v-bar');
	});

	it('says nothing about a session that logged nothing', () => {
		const empty = workout(100, leg('triceps-pushdown', [], 'bar'));

		expect(lastGripsFrom([empty])['triceps-pushdown']).toBeUndefined();
	});
});

describe('folded slugs', () => {
	// The payoff of folding rather than stranding: the sets land on their parent stamped with the
	// grip they were performed with, and a wide-grip pulldown lands on the default.
	it('read as their parent, each set under the grip it became', () => {
		const sessions = sessionsByExercise(
			[
				workout(
					100,
					leg('close-grip-lat-pulldown', [{ weight: 60, reps: 10 }]),
					leg('wide-grip-lat-pulldown', [{ weight: 55, reps: 10 }]),
					leg('lat-pulldown', [{ weight: 50, reps: 12 }])
				)
			].map((entry) => foldWorkout(entry))
		);

		const [session] = sessions['lat-pulldown'];

		expect(only(session.sets)).toEqual([60, 55, 50]);
		expect(only(narrowTo(sessions['lat-pulldown'], 'neutral')[0].sets)).toEqual([60]);
	});

	it('leave a workout that names nothing retired untouched', () => {
		const clean = workout(100, leg('squat', [{ weight: 100, reps: 5 }]));

		expect(foldWorkout(clean)).toBe(clean);
	});
});

describe('heaviestFrom', () => {
	it('ranks weight first, then reps at it, across every session', () => {
		const heaviest = heaviestFrom([
			workout(
				100,
				leg('bench-press', [
					{ weight: 80, reps: 5 },
					{ weight: 100, reps: 2 }
				])
			),
			workout(200, leg('bench-press', [{ weight: 100, reps: 1 }]))
		]);

		expect(heaviest['bench-press']).toMatchObject({ weight: 100, reps: 2 });
	});
});
