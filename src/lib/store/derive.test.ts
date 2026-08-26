import { describe, expect, it } from 'vitest';

import type { WorkoutEntry, WorkoutExercise, WorkoutSet } from '$lib/domain/workout';

import type { FinishedWorkout } from './derive.ts';
import {
	frequentFrom,
	gripSessionsFrom,
	heaviestFrom,
	historyFrom,
	lastGripsFrom,
	lastPerformedFrom,
	sessionsByExercise,
	sessionsByKey
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

describe('grip-keyed history', () => {
	it('files the default grip under the bare slug and every other one beside it', () => {
		const sessions = sessionsByKey([
			workout(
				100,
				leg('triceps-pushdown', [
					{ weight: 30, reps: 12, grip: 'rope' },
					{ weight: 40, reps: 8, grip: 'bar' }
				])
			)
		]);

		expect(Object.keys(sessions).toSorted()).toEqual(['triceps-pushdown', 'triceps-pushdown#bar']);
		expect(only(sessions['triceps-pushdown'][0].sets)).toEqual([30]);
		expect(only(sessions['triceps-pushdown#bar'][0].sets)).toEqual([40]);
	});

	it('merges sets logged before the axis existed into the default grip', () => {
		const sessions = sessionsByKey([
			workout(100, leg('triceps-pushdown', [{ weight: 30, reps: 12 }])),
			workout(200, leg('triceps-pushdown', [{ weight: 32.5, reps: 12, grip: 'rope' }]))
		]);

		expect(sessions['triceps-pushdown']).toHaveLength(2);
		expect(sessions['triceps-pushdown#bar']).toBeUndefined();
	});

	it('numbers both grips as the same exercise of the session, because they were one trip', () => {
		const sessions = sessionsByKey([
			workout(
				100,
				leg('squat', [{ weight: 100, reps: 5 }]),
				leg('triceps-pushdown', [
					{ weight: 30, reps: 12, grip: 'rope' },
					{ weight: 40, reps: 8, grip: 'bar' }
				])
			)
		]);

		expect(sessions['triceps-pushdown'][0].position).toBe(2);
		expect(sessions['triceps-pushdown#bar'][0].position).toBe(2);
	});
});

describe('base-keyed reads', () => {
	const both = [
		workout(
			100,
			leg('triceps-pushdown', [
				{ weight: 30, reps: 12, grip: 'rope' },
				{ weight: 40, reps: 8, grip: 'bar' }
			])
		)
	];

	it('keep every grip together under the slug', () => {
		expect(only(sessionsByExercise(both)['triceps-pushdown'][0].sets)).toEqual([30, 40]);
		expect(lastPerformedFrom(both)['triceps-pushdown']).toBeDefined();
		expect(only(lastPerformedFrom(both)['triceps-pushdown']!.sets)).toEqual([30, 40]);
	});

	it('count the exercise once on the shelf, not once per grip', () => {
		expect(frequentFrom(both)).toEqual(['triceps-pushdown']);
	});
});

describe('historyFrom', () => {
	it('recalls the last session of each grip, not the last session of the exercise', () => {
		const history = historyFrom([
			workout(100, leg('triceps-pushdown', [{ weight: 40, reps: 8, grip: 'bar' }])),
			workout(200, leg('triceps-pushdown', [{ weight: 32.5, reps: 12, grip: 'rope' }]))
		]);

		expect(only(history['triceps-pushdown'] ?? [])).toEqual([32.5]);
		expect(only(history['triceps-pushdown#bar'] ?? [])).toEqual([40]);
	});
});

describe('lastGripsFrom', () => {
	it('remembers what the exercise was last worked with, so an insert opens on it', () => {
		const grips = lastGripsFrom([
			workout(100, leg('triceps-pushdown', [{ weight: 40, reps: 8, grip: 'bar' }], 'bar')),
			workout(200, leg('triceps-pushdown', [{ weight: 32.5, reps: 12, grip: 'v-bar' }], 'v-bar'))
		]);

		expect(grips['triceps-pushdown']).toBe('v-bar');
	});

	it('says nothing about a session that logged nothing', () => {
		const empty = workout(100, leg('triceps-pushdown', [], 'bar'));

		expect(lastGripsFrom([empty])['triceps-pushdown']).toBeUndefined();
	});
});

describe('gripSessionsFrom', () => {
	it('hands back one exercise across all its grips, and nobody else’s', () => {
		const gripped = gripSessionsFrom(
			[
				workout(
					100,
					leg('triceps-pushdown', [
						{ weight: 30, reps: 12, grip: 'rope' },
						{ weight: 40, reps: 8, grip: 'bar' }
					]),
					leg('squat', [{ weight: 100, reps: 5 }])
				)
			],
			'triceps-pushdown'
		);

		expect(Object.keys(gripped).toSorted()).toEqual(['triceps-pushdown', 'triceps-pushdown#bar']);
	});
});

describe('folded slugs', () => {
	// The payoff of folding rather than stranding: the sets land on the chip they were performed
	// with, and a wide-grip pulldown lands on the default, which is where plain pulldowns already are.
	it('read as their parent under the grip they became', () => {
		const sessions = sessionsByKey(
			[
				workout(
					100,
					leg('close-grip-lat-pulldown', [{ weight: 60, reps: 10 }]),
					leg('wide-grip-lat-pulldown', [{ weight: 55, reps: 10 }]),
					leg('lat-pulldown', [{ weight: 50, reps: 12 }])
				)
			].map((entry) => foldWorkout(entry))
		);

		expect(only(sessions['lat-pulldown'][0].sets)).toEqual([55, 50]);
		expect(only(sessions['lat-pulldown#close'][0].sets)).toEqual([60]);
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
