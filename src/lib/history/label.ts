import { catalogById } from '$lib/catalog';
import { countedDays } from '$lib/format/when';
import type { Exercise } from '$lib/domain/exercise';
import type { Template } from '$lib/domain/template';
import type { Workout } from '$lib/domain/workout';
import { exercisesLabel, setsLabel, templateTitle } from '$lib/templates/plan';

export function workoutTitle(workout: Workout, templates: Template[]): string {
	const template = templates.find((candidate) => candidate.id === workout.templateId);

	if (template !== undefined) {
		return templateTitle(template);
	}

	const names = workout.entries
		.flatMap((entry) => entry.exercises)
		.map((exercise): Exercise | undefined => catalogById[exercise.exerciseId])
		.filter((meta) => meta !== undefined)
		.map((meta) => meta.name);

	if (names.length === 0) {
		return 'Workout';
	}

	return names.length === 1 ? names[0] : `${names[0]} + ${names.length - 1} more`;
}

export function completedSetCount(workout: Workout): number {
	return workout.entries
		.flatMap((entry) => entry.exercises)
		.flatMap((exercise) => exercise.sets)
		.filter(
			(set) => set.completed && set.type !== 'warmup' && set.weight !== null && set.reps !== null
		).length;
}

export function exerciseCount(workout: Workout): number {
	return workout.entries.reduce((count, entry) => count + entry.exercises.length, 0);
}

export function workoutMeta(workout: Workout): string {
	const exercises = exerciseCount(workout);
	const sets = completedSetCount(workout);

	return `${exercisesLabel(exercises)} · ${setsLabel(sets)}`;
}

const DAY = 86_400_000;

export function formatSince(then: number, now: number): string {
	const days = Math.floor((now - then) / DAY);

	if (days < 1) {
		return 'today';
	}

	if (days < 14) {
		return `${days}d`;
	}

	if (days < 63) {
		return `${Math.floor(days / 7)}w`;
	}

	return `${Math.floor(days / 30)}mo`;
}

export type When = { short: string; long: string };

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const dayMonthYear = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'short',
	year: 'numeric'
});
const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });

function startOfDay(ms: number): number {
	const date = new Date(ms);

	date.setHours(0, 0, 0, 0);

	return date.getTime();
}

export function formatWhen(then: number, now: number): When {
	// Math.round, not floor: across a DST boundary the gap between two midnights is 23 or 25 hours.
	const days = Math.round((startOfDay(now) - startOfDay(then)) / DAY);
	const counted = countedDays(days);

	if (counted !== null) {
		return { short: counted, long: days < 2 ? counted : `${days} days ago` };
	}

	const sameYear = new Date(then).getFullYear() === new Date(now).getFullYear();
	const date = sameYear ? dayMonth.format(then) : dayMonthYear.format(then);

	return { short: date, long: `${weekday.format(then)}, ${date}` };
}

/**
 * A plan's recency as a line of prose rather than a trailing column.
 *
 * `formatWhen` heads its phrases for a column of their own; the first two are the only ones
 * that read wrong mid-sentence, and a date keeps its capitals wherever it sits.
 */
export function lastDoneLine(then: number | null, now: number): string {
	if (then === null) {
		return 'Never trained';
	}

	const { long } = formatWhen(then, now);

	return long === 'Today' || long === 'Yesterday'
		? `Trained ${long.toLowerCase()}`
		: `Trained ${long}`;
}
