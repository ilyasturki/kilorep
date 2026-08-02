import { describe, expect, test } from 'vitest';

import { catalog } from '$lib/catalog';
import { completedSetCount, exerciseCount, formatSince, workoutTitle } from '$lib/history/label';
import type { Workout, WorkoutSet } from '$lib/domain/workout';

/**
 * The words that break silently: a wrong title reads as a plausible workout,
 * a wrong tally as a quiet session. The catalog ids are real ones, because a
 * fallback title built on a typo'd id would pass any test using made-up ids.
 */

const [first, second] = catalog;

type SetSpec = {
	type?: WorkoutSet['type'];
	completed?: boolean;
	weight?: number | null;
	reps?: number | null;
};

const set = (spec: SetSpec, id: string): WorkoutSet => ({
	id,
	type: spec.type ?? 'normal',
	plannedReps: null,
	weight: spec.weight === undefined ? 100 : spec.weight,
	reps: spec.reps === undefined ? 5 : spec.reps,
	completed: spec.completed ?? true
});

function workout(templateId: string | null, exerciseIds: string[], sets: WorkoutSet[]): Workout {
	return {
		id: 'w',
		templateId,
		startedAt: 0,
		entries: exerciseIds.map((exerciseId, i) => ({
			id: `entry-${i}`,
			exercises: [{ id: `ex-${i}`, exerciseId, sets: i === 0 ? sets : [] }]
		}))
	};
}

describe('workoutTitle', () => {
	const templates = [
		{ id: 't1', name: 'Push day', createdAt: 0, entries: [] },
		{ id: 't2', name: '   ', createdAt: 0, entries: [] }
	];

	test('a live template names the workout', () => {
		expect(workoutTitle(workout('t1', [first.id], []), templates)).toBe('Push day');
	});

	test('a nameless template reads Untitled, like the Start list', () => {
		expect(workoutTitle(workout('t2', [first.id], []), templates)).toBe('Untitled');
	});

	test('a gone template falls back to what was done', () => {
		expect(workoutTitle(workout('gone', [first.id], []), templates)).toBe(first.name);
		expect(workoutTitle(workout(null, [first.id, second.id], []), templates)).toBe(
			`${first.name} + 1 more`
		);
	});

	test('nothing to name is still a workout', () => {
		expect(workoutTitle(workout(null, [], []), templates)).toBe('Workout');
	});
});

describe('completedSetCount', () => {
	test('counts completed working sets only', () => {
		const sets = [
			set({}, 's1'),
			set({ type: 'warmup' }, 's2'),
			set({ completed: false, weight: null, reps: null }, 's3'),
			set({ type: 'drop' }, 's4')
		];

		expect(completedSetCount(workout(null, [first.id], sets))).toBe(2);
	});
});

describe('exerciseCount', () => {
	test('counts every block, superset legs and repeats included', () => {
		const paired: Workout = {
			id: 'w',
			templateId: null,
			startedAt: 0,
			entries: [
				// A superset: one entry, two exercises, two blocks on screen.
				{
					id: 'e0',
					exercises: [
						{ id: 'x0', exerciseId: first.id, sets: [] },
						{ id: 'x1', exerciseId: second.id, sets: [] }
					]
				},
				// The same exercise again, later in the session.
				{ id: 'e1', exercises: [{ id: 'x2', exerciseId: first.id, sets: [] }] }
			]
		};

		expect(exerciseCount(paired)).toBe(3);
	});

	test('an exercise with nothing logged still counts', () => {
		const sets = [set({ completed: false, weight: null, reps: null }, 's1')];

		expect(exerciseCount(workout(null, [first.id], sets))).toBe(1);
		expect(completedSetCount(workout(null, [first.id], sets))).toBe(0);
	});

	test('an emptied record counts nothing', () => {
		expect(exerciseCount(workout(null, [], []))).toBe(0);
	});
});

describe('formatSince', () => {
	const DAY = 86_400_000;
	const since = (days: number): string => formatSince(0, days * DAY);

	test('anything inside the day is today', () => {
		expect(since(0)).toBe('today');
		expect(formatSince(0, DAY - 1)).toBe('today');
		expect(since(1)).toBe('1d');
	});

	test('days to a fortnight, then weeks, then months', () => {
		expect(since(13)).toBe('13d');
		expect(since(14)).toBe('2w');
		expect(since(62)).toBe('8w');
		expect(since(63)).toBe('2mo');
		expect(since(365)).toBe('12mo');
	});

	test('the scale never steps backwards at a seam', () => {
		// 8w is 56 days and the first month figure would claim ~61, so the weeks
		// run to 62 rather than handing over at 56 and reading as *less* time.
		expect(since(56)).toBe('8w');
		expect(since(60)).toBe('8w');
	});

	test('a clock-skewed future timestamp reads as today, never negative', () => {
		expect(formatSince(10 * DAY, 0)).toBe('today');
	});
});
