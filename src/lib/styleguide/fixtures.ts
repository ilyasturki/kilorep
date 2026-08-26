// One session, one plan and one lifter's numbers, so every app specimen on the sheet is
// describing the same afternoon. Built on `$lib/domain/fixture` — the shape the tests already
// agree on — rather than a second set of invented records that could drift from it.

import { catalogById } from '$lib/catalog';
import type { BodyweightEntry } from '$lib/domain/bodyweight';
import { freshWorkout } from '$lib/domain/fixture';
import type { PastSession } from '$lib/domain/stats';
import type { Template, TemplateExercise, TemplateMark, TemplateSet } from '$lib/domain/template';
import type { Workout } from '$lib/domain/workout';

export { history as sessionHistory } from '$lib/domain/fixture';

/** A Wednesday evening, so nothing on the sheet renders a different "today" per reload. */
export const NOW = Date.UTC(2026, 7, 26, 18, 24);

const STARTED = NOW - 21 * 60_000;

export const bench = catalogById['bench-press'];
export const incline = catalogById['incline-dumbbell-press'];
export const fly = catalogById['cable-fly'];

/**
 * The session mid-flight: the warmup and two working sets are in, the third is where the
 * lifter is standing. A fresh object per call, so a specimen that mutates it cannot reach
 * across the page into another card.
 */
export function liveWorkout(): Workout {
	const workout = freshWorkout(STARTED);

	const [first, second] = workout.entries[0].exercises[0].sets.slice(1);

	Object.assign(first, { weight: 82.5, reps: 8, rpe: 8, completed: true, entered: true });
	Object.assign(second, { weight: 82.5, reps: 7, rpe: 9, completed: true, entered: true });

	return workout;
}

/** The plan behind it — four sets of eight, resting three minutes. */
export function planExercise(): TemplateExercise {
	return {
		id: 'te-bench',
		exerciseId: 'bench-press',
		restSeconds: 180,
		sets: Array.from({ length: 4 }, (_, i) => ({ id: `ts-${i + 1}`, plannedReps: 8 }))
	};
}

const planSets = (count: number, plannedReps: number | null, key: string): TemplateSet[] =>
	Array.from({ length: count }, (_, i) => ({ id: `${key}-${i + 1}`, plannedReps }));

/** The plan those sets came from — a superset in the middle, so the rail has something to mark. */
export function pushTemplate(): Template {
	return {
		id: 'push-a',
		name: 'Push A',
		createdAt: NOW - 60 * 86_400_000,
		mark: { icon: 'push', colour: 'blue' },
		entries: [
			{
				id: 'pe-bench',
				exercises: [Object.assign(planExercise(), { id: 'pe-bench-1' })]
			},
			{
				id: 'pe-incline',
				exercises: [
					{ id: 'pe-incline-1', exerciseId: 'incline-dumbbell-press', sets: planSets(3, 10, 'inc') }
				]
			},
			{
				id: 'pe-super',
				exercises: [
					{ id: 'pe-fly-1', exerciseId: 'cable-fly', sets: planSets(3, 12, 'fly') },
					{ id: 'pe-pec-1', exerciseId: 'pec-deck', sets: planSets(3, 12, 'pec') }
				]
			}
		]
	};
}

export const marks: TemplateMark[] = [
	{ icon: 'push', colour: 'blue' },
	{ icon: 'pull', colour: 'teal' },
	{ icon: 'legs', colour: 'amber' },
	{ icon: null, colour: 'violet' },
	{ icon: 'star', colour: null },
	{ icon: null, colour: null }
];

/** Twelve weeks of a slow cut, weighed most mornings — enough for the trend line to mean it. */
export function bodyweightSeries(): BodyweightEntry[] {
	const start = Date.UTC(2026, 5, 3);

	return Array.from({ length: 84 }, (_, day) => {
		const date = new Date(start + day * 86_400_000).toISOString().slice(0, 10);

		// A drift down with a weekly wobble on it: a clean ramp would make the rolling average
		// sit exactly on the dots and the chart would stop showing what it is for.
		const drift = 84.2 - day * 0.031;
		const wobble = Math.sin(day / 2.7) * 0.42 + Math.sin(day / 6.1) * 0.28;

		return { date, kg: Math.round((drift + wobble) * 10) / 10 };
	}).filter((_, day) => day % 7 !== 3);
}

/** Bench, one session a week, creeping up — what the estimate and its sparkline read. */
export function benchSessions(): PastSession[] {
	const weeks = [
		[[75, 8] as const, [75, 8] as const, [72.5, 8] as const],
		[[77.5, 8] as const, [77.5, 7] as const, [75, 8] as const],
		[[77.5, 8] as const, [77.5, 8] as const, [77.5, 7] as const],
		[[80, 8] as const, [80, 7] as const, [77.5, 8] as const],
		[[80, 8] as const, [80, 8] as const, [80, 7] as const],
		[[82.5, 8] as const, [82.5, 7] as const, [80, 8] as const]
	];

	return weeks.map((sets, week) => ({
		date: NOW - (weeks.length - week) * 7 * 86_400_000,
		workoutId: `sg-bench-${week}`,
		position: 1,
		sets: sets.map(([weight, reps]) => ({ weight, reps, rpe: null }))
	}));
}

/** The same numbers as points, for the bare Sparkline specimen. */
export function trendPoints(): { x: number; y: number }[] {
	return benchSessions().map((session, i) => ({
		x: i,
		y: Math.max(...session.sets.map((set) => set.weight))
	}));
}
