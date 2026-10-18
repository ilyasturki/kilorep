import { catalogById } from '$lib/catalog';
import { DAY_MS, countedDays, midnightsBetween } from '$lib/format/when';
import { dateFormat } from '$lib/format/locale';
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

export function formatSince(then: number, now: number): string {
	const days = Math.floor((now - then) / DAY_MS);

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

const dayMonth = dateFormat({ day: 'numeric', month: 'short' });
const dayMonthYear = dateFormat({
	day: 'numeric',
	month: 'short',
	year: 'numeric'
});
const weekday = dateFormat({ weekday: 'short' });

export function formatWhen(then: number, now: number): When {
	const days = midnightsBetween(then, now);
	const counted = countedDays(days);

	if (counted !== null) {
		return { short: counted, long: days < 2 ? counted : `${days} days ago` };
	}

	const sameYear = new Date(then).getFullYear() === new Date(now).getFullYear();
	const date = sameYear ? dayMonth.format(then) : dayMonthYear.format(then);

	return { short: date, long: `${weekday.format(then)}, ${date}` };
}

export function trainedWhen(then: number | null, now: number): When {
	if (then === null) {
		return { short: 'Never', long: 'Never trained' };
	}

	const since = formatSince(then, now);

	return since === 'today'
		? { short: 'Today', long: 'Trained today' }
		: { short: `${since} ago`, long: `Trained ${since} ago` };
}

function minutesLabel(minutes: number): string {
	if (minutes < 60) {
		return `${minutes} min`;
	}

	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;

	return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function elapsedLabel(startedAt: number, now: number): string {
	const minutes = Math.max(0, Math.floor((now - startedAt) / 60_000));

	return minutes < 1 ? 'Just started' : minutesLabel(minutes);
}

/** How long a session took, or null where the record holds no length worth saying. */
export function lastedLabel(lasted: number): string | null {
	const minutes = Math.round(lasted / 60_000);

	return minutes < 1 ? null : minutesLabel(minutes);
}
