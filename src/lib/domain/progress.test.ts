import { describe, expect, test } from 'vitest';

import {
	estTrend,
	mainLifts,
	muscleSets,
	recentPrs,
	rollingConsistency,
	WEEK,
	weeklyWork
} from '$lib/domain/progress';
import type { Exercise, LoadMode, Muscle } from '$lib/domain/exercise';
import type { PastSession } from '$lib/domain/stats';
import type { SetType, Workout, WorkoutSet } from '$lib/domain/workout';

const DAY = 86_400_000;

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

describe('weeklyWork', () => {
	const NOW = monday(10);
	const ago = (days: number): number => NOW - days * DAY;

	test('every bucket is a full week wide and the last one ends at now', () => {
		const weeks = weeklyWork([], NOW, one, 12);

		expect(weeks).toHaveLength(12);
		expect(weeks[0].start).toBe(NOW - 12 * WEEK);
		expect(weeks[11].start).toBe(NOW - WEEK);
		expect(weeks.every((week) => week.kg === 0 && week.sets === 0)).toBe(true);
	});

	test('a session lands in a bucket by age, counted back from now', () => {
		const weeks = weeklyWork(
			[workout(ago(6), 'bench-press', [set(100, 5)]), workout(ago(8), 'bench-press', [set(50, 5)])],
			NOW,
			one,
			12
		);

		expect(weeks[11]).toEqual({ start: NOW - WEEK, kg: 500, sets: 1 });
		expect(weeks[10]).toEqual({ start: NOW - 2 * WEEK, kg: 250, sets: 1 });
	});

	test('load factor multiplies tonnage and never the set count', () => {
		const weeks = weeklyWork([workout(ago(2), 'db-press', [set(20, 10)])], NOW, () => 2, 12);

		expect(weeks[11].kg).toBe(400);
		expect(weeks[11].sets).toBe(1);
	});

	test('warmups and uncompleted sets count for neither figure', () => {
		const weeks = weeklyWork(
			[
				workout(ago(2), 'bench-press', [
					set(100, 5),
					set(100, 5, 'warmup'),
					set(100, 5, 'normal', false)
				])
			],
			NOW,
			one,
			12
		);

		expect(weeks[11]).toMatchObject({ kg: 500, sets: 1 });
	});

	test('sessions older than the window fall outside it entirely', () => {
		const weeks = weeklyWork([workout(ago(90), 'bench-press', [set(100, 5)])], NOW, one, 12);

		expect(weeks.every((week) => week.sets === 0)).toBe(true);
	});
});

describe('rollingConsistency', () => {
	const NOW = monday(10);
	const ago = (days: number): number => NOW - days * DAY;

	test('an empty log has no median rather than a median of zero', () => {
		expect(rollingConsistency([], NOW)).toEqual({ last7: 0, median: null, weeks: [] });
	});

	test('the last seven days are counted against the seven-day windows behind them', () => {
		const startedAts = [ago(1), ago(4), ago(9), ago(11), ago(13), ago(16), ago(25), ago(27)];

		const result = rollingConsistency(startedAts, NOW);

		expect(result.last7).toBe(2);
		expect(result.weeks).toEqual([2, 1, 3]);
		expect(result.median).toBe(2);
	});

	test('the running week is never one of the windows it is judged against', () => {
		const result = rollingConsistency([ago(1), ago(2), ago(3), ago(10)], NOW);

		expect(result.last7).toBe(3);
		expect(result.weeks).toEqual([1]);
		expect(result.median).toBe(1);
	});

	test('windows that ended before the log began count for nothing, not for zero', () => {
		const result = rollingConsistency([ago(9), ago(2)], NOW);

		expect(result.weeks).toEqual([1]);
		expect(result.median).toBe(1);
	});

	test('an even count of windows takes the midpoint of the two middles', () => {
		const result = rollingConsistency([ago(8), ago(15), ago(16), ago(17)], NOW);

		expect(result.weeks).toEqual([3, 1]);
		expect(result.median).toBe(2);
	});
});

describe('muscleSets', () => {
	const byId = new Map<string, Exercise>([
		['bench-press', exercise('bench-press', 'total', 'Chest', ['Triceps', 'Shoulders'])],
		['db-curl', exercise('db-curl', 'per-hand', 'Biceps', [])]
	]);

	const resolver = (id: string): Exercise | undefined => byId.get(id);

	test('the primary takes a direct set and every secondary an indirect one', () => {
		const rows = muscleSets([workout(60, 'bench-press', [set(100, 5), set(100, 5)])], 50, resolver);

		expect(rows.find((row) => row.muscle === 'Chest')).toEqual({
			muscle: 'Chest',
			direct: 2,
			indirect: 0
		});
		expect(rows.find((row) => row.muscle === 'Triceps')).toEqual({
			muscle: 'Triceps',
			direct: 0,
			indirect: 2
		});
		expect(rows).toContainEqual({ muscle: 'Shoulders', direct: 0, indirect: 2 });
		expect(rows).toHaveLength(11);
	});

	test('a muscle can earn both, and a set is a set at any load mode', () => {
		const rows = muscleSets(
			[
				workout(60, 'db-curl', [set(20, 10), set(20, 10)]),
				workout(70, 'bench-press', [set(100, 5)])
			],
			50,
			resolver
		);

		expect(rows.find((row) => row.muscle === 'Biceps')).toEqual({
			muscle: 'Biceps',
			direct: 2,
			indirect: 0
		});
		expect(rows).toContainEqual({ muscle: 'Chest', direct: 1, indirect: 0 });
	});

	test('warmups and uncompleted sets never count', () => {
		const rows = muscleSets(
			[workout(60, 'db-curl', [set(20, 10, 'warmup'), set(20, 10, 'normal', false)])],
			50,
			resolver
		);

		expect(rows.every((row) => row.direct === 0 && row.indirect === 0)).toBe(true);
	});

	test('workouts before the window and unknown exercises count for nothing', () => {
		const rows = muscleSets(
			[workout(10, 'bench-press', [set(100, 5)]), workout(60, 'mystery-custom', [set(100, 5)])],
			50,
			resolver
		);

		expect(rows.every((row) => row.direct === 0 && row.indirect === 0)).toBe(true);
	});

	test('an untrained muscle is a named zero, never a missing row', () => {
		const rows = muscleSets([workout(60, 'db-curl', [set(20, 10)])], 50, resolver);

		expect(rows.find((row) => row.muscle === 'Calves')).toEqual({
			muscle: 'Calves',
			direct: 0,
			indirect: 0
		});
	});
});
