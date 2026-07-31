import { describe, expect, test } from 'vitest';

import { catalog } from '$lib/catalog';
import { completedSetCount, formatDuration, workoutTitle } from '$lib/history/label';
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

describe('formatDuration', () => {
	test('never a zero', () => {
		expect(formatDuration(0, 10_000)).toBe('1 min');
	});

	test('minutes under the hour, hours past it', () => {
		expect(formatDuration(0, 45 * 60_000)).toBe('45 min');
		expect(formatDuration(0, 60 * 60_000)).toBe('1 h');
		expect(formatDuration(0, 85 * 60_000)).toBe('1 h 25 min');
	});
});
