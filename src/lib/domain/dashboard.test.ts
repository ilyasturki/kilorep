import { describe, expect, test } from 'vitest';

import { consistency, estTrend, mainLifts, muscleVolume, recentPrs } from '$lib/domain/dashboard';
import type { Exercise, LoadMode, Muscle } from '$lib/domain/exercise';
import type { PastSession } from '$lib/domain/stats';
import type { SetType, Workout, WorkoutSet } from '$lib/domain/workout';

const session = (date: number, sets: [number, number][]): PastSession => ({
	date,
	workoutId: `w${date}`,
	position: 1,
	sets: sets.map(([weight, reps]) => ({ weight, reps, rpe: null }))
});

const one = (): number => 1;

const monday = (weeksOn: number, day = 0, hour = 12): number =>
	new Date(2024, 0, 1 + weeksOn * 7 + day, hour).getTime();

const exercise = (
	id: string,
	loadMode: LoadMode,
	primary: Muscle,
	secondary: Muscle[]
): Exercise => ({
	id,
	name: id,
	aliases: [],
	equipment: 'Barbell',
	loadMode,
	muscles: { primary, secondary }
});

const set = (
	weight: number,
	reps: number,
	type: SetType = 'normal',
	completed = true
): WorkoutSet => ({ id: 's', type, plannedReps: null, weight, reps, rpe: null, completed });

const workout = (startedAt: number, exerciseId: string, sets: WorkoutSet[]): Workout => ({
	id: `w${startedAt}`,
	templateId: null,
	startedAt,
	entries: [{ id: 'e', exercises: [{ id: 'x', exerciseId, sets }] }]
});

describe('recentPrs', () => {
	test('a PR set inside the window makes the card', () => {
		const prs = recentPrs(
			{ 'bench-press': [session(10, [[100, 5]]), session(90, [[102.5, 5]])] },
			50
		);

		expect(prs).toEqual([
			{ exerciseId: 'bench-press', set: { weight: 102.5, reps: 5, rpe: null }, date: 90 }
		]);
	});

	test('a first-ever session sets a best, not news', () => {
		expect(recentPrs({ 'pec-deck': [session(90, [[50, 10]])] }, 50)).toEqual([]);
	});

	test('matching an old PR in the window is not a new one', () => {
		const prs = recentPrs(
			{ 'bench-press': [session(1, [[80, 5]]), session(10, [[100, 5]]), session(90, [[100, 5]])] },
			50
		);

		expect(prs).toEqual([]);
	});

	test('newest first across exercises', () => {
		const prs = recentPrs(
			{
				squat: [session(10, [[100, 5]]), session(60, [[110, 5]])],
				deadlift: [session(10, [[140, 5]]), session(80, [[150, 5]])]
			},
			50
		);

		expect(prs.map((pr) => pr.exerciseId)).toEqual(['deadlift', 'squat']);
	});
});

describe('mainLifts', () => {
	test('ranked by sessions inside the window', () => {
		const lifts = mainLifts(
			{
				squat: [session(60, [[100, 5]]), session(70, [[100, 5]]), session(80, [[100, 5]])],
				curl: [session(60, [[20, 10]]), session(70, [[20, 10]])]
			},
			50,
			one
		);

		expect(lifts).toEqual(['squat', 'curl']);
	});

	test('sessions before the window count for nothing', () => {
		const lifts = mainLifts(
			{
				squat: [session(1, [[100, 5]]), session(2, [[100, 5]]), session(60, [[100, 5]])],
				curl: [session(60, [[20, 10]]), session(70, [[20, 10]])]
			},
			50,
			one
		);

		expect(lifts).toEqual(['curl']);
	});

	test('one session in the window has no direction and does not qualify', () => {
		expect(mainLifts({ squat: [session(60, [[100, 5]])] }, 50, one)).toEqual([]);
	});

	test('a session-count tie settles on volume, load factor included', () => {
		const lifts = mainLifts(
			{
				squat: [session(60, [[60, 5]]), session(70, [[60, 5]])],
				'db-press': [session(60, [[20, 10]]), session(70, [[20, 10]])]
			},
			50,
			(exerciseId) => (exerciseId === 'db-press' ? 2 : 1)
		);

		expect(lifts).toEqual(['db-press', 'squat']);
	});

	test('caps at count, most-trained first', () => {
		const two = (date: number): PastSession[] => [
			session(date, [[50, 5]]),
			session(date + 1, [[50, 5]])
		];

		const lifts = mainLifts({ a: two(60), b: two(62), c: two(64), d: two(66) }, 50, one, 3);

		expect(lifts).toHaveLength(3);
	});
});

describe('estTrend', () => {
	test('one point per session, valued at its best Epley estimate', () => {
		const points = estTrend(
			[
				session(60, [
					[100, 5],
					[100, 8]
				]),
				session(70, [[102.5, 5]])
			],
			50
		);

		expect(points).toEqual([
			{ date: 60, est: 100 * (1 + 8 / 30) },
			{ date: 70, est: 102.5 * (1 + 5 / 30) }
		]);
	});

	test('sessions before the window contribute no point', () => {
		expect(estTrend([session(10, [[100, 5]]), session(60, [[100, 5]])], 50)).toHaveLength(1);
	});

	test('a bodyweight zero estimates nothing', () => {
		expect(estTrend([session(60, [[0, 12]])], 50)).toEqual([]);
	});
});

describe('consistency', () => {
	test('an empty log has no habit rather than a habit of zero', () => {
		expect(consistency([], new Date(2024, 0, 31))).toEqual({
			thisWeek: 0,
			habit: null,
			weeks: []
		});
	});

	test('counts this week from Monday and takes the median over full weeks', () => {
		const startedAts = [
			monday(0), // week of 1 Jan: 1 session
			monday(1),
			monday(1, 2),
			monday(1, 4), // week of 8 Jan: 3
			monday(2), // week of 15 Jan: 1
			monday(3),
			monday(3, 3), // week of 22 Jan: 2
			monday(4),
			monday(4, 1) // the running week: 2
		];

		const result = consistency(startedAts, new Date(2024, 0, 31));

		expect(result.thisWeek).toBe(2);
		expect(result.weeks).toEqual([1, 3, 1, 2]);
		expect(result.habit).toBe(1.5);
	});

	test('weeks before the log began count for nothing, not for zero', () => {
		const result = consistency([monday(3), monday(4, 2)], new Date(2024, 0, 31));

		expect(result.weeks).toEqual([1]);
		expect(result.habit).toBe(1);
	});

	test('a Sunday session lands in its Monday-started week', () => {
		const result = consistency([monday(3, 6, 23)], new Date(2024, 0, 31));

		expect(result.thisWeek).toBe(0);
		expect(result.weeks).toEqual([1]);
	});
});

describe('muscleVolume', () => {
	const byId = new Map<string, Exercise>([
		['bench-press', exercise('bench-press', 'total', 'Chest', ['Triceps'])],
		['db-curl', exercise('db-curl', 'per-hand', 'Biceps', [])]
	]);

	const resolver = (id: string): Exercise | undefined => byId.get(id);

	test('volume lands on the primary muscle alone, zero rows included', () => {
		const rows = muscleVolume([workout(60, 'bench-press', [set(100, 5)])], 50, resolver);

		expect(rows.find((row) => row.muscle === 'Chest')).toEqual({ muscle: 'Chest', kg: 500 });
		expect(rows.find((row) => row.muscle === 'Triceps')).toEqual({ muscle: 'Triceps', kg: 0 });
		expect(rows).toHaveLength(11);
	});

	test('per-hand doubles, warmups and uncompleted sets never count', () => {
		const rows = muscleVolume(
			[workout(60, 'db-curl', [set(20, 10), set(20, 10, 'warmup'), set(20, 10, 'normal', false)])],
			50,
			resolver
		);

		expect(rows.find((row) => row.muscle === 'Biceps')).toEqual({ muscle: 'Biceps', kg: 400 });
	});

	test('workouts before the window and unknown exercises count for nothing', () => {
		const rows = muscleVolume(
			[workout(10, 'bench-press', [set(100, 5)]), workout(60, 'mystery-custom', [set(100, 5)])],
			50,
			resolver
		);

		expect(rows.every((row) => row.kg === 0)).toBe(true);
	});
});
