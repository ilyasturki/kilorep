import { catalogById } from '$lib/catalog';
import { countedDays } from '$lib/format/when';
import type { Exercise } from '$lib/domain/exercise';
import type { Template } from '$lib/domain/template';
import type { Workout } from '$lib/domain/workout';
import { templateTitle } from '$lib/templates/plan';

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

/**
 * How big the session was, in the two numbers a lifter scans for: how much was
 * trained, and how much work it took. How long it took is deliberately absent —
 * a session is a day in this app, not a stopwatch reading, and the clock a
 * record carries is plumbing (the sort key, the finished marker) rather than
 * something to answer for.
 *
 * Takes a plain `Workout`, so a live session is described by the same sentence
 * as a finished one. Nothing checked yet reads `0 sets` honestly — warmups and
 * uncompleted sets never count, live or not.
 *
 * Here rather than on either screen that says it: History's list and the idle
 * Train screen both name the same past session, and a second copy of this is a
 * chance for the two to start disagreeing about what a set is.
 */
export function workoutMeta(workout: Workout): string {
	const exercises = exerciseCount(workout);
	const sets = completedSetCount(workout);

	return [
		exercises === 1 ? '1 exercise' : `${exercises} exercises`,
		sets === 1 ? '1 set' : `${sets} sets`
	].join(' · ');
}

const DAY = 86_400_000;

/**
 * How long since, in the coarsest unit that still answers the question —
 * `today`, `9d`, `5w`, `4mo`. The catalog rows carry this beside a name, where
 * the question is "am I neglecting this", and a date makes the reader do the
 * subtraction to find out.
 *
 * Elapsed time, not calendar days: a session eight hours ago is `today`
 * whether or not midnight fell between. The units are deliberately unequal —
 * days up to a fortnight, then weeks, then months — because precision stops
 * mattering as the gap grows, and `63d` is a number nobody converts.
 *
 * A future timestamp reads as `today` rather than going negative. Records
 * arrive from other devices, and two phones disagreeing about the clock by a
 * minute must not print `-1d`.
 */
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

/** Local midnight before `ms`. The calendar day is the unit, not the clock. */
function startOfDay(ms: number): number {
	const date = new Date(ms);

	date.setHours(0, 0, 0, 0);

	return date.getTime();
}

/**
 * When a session happened, in the words a lifter would use for it: `Today`,
 * `Yesterday`, `3d`, and a date once counting stops being an answer.
 *
 * Calendar days, unlike `formatSince` above — that one measures elapsed time
 * because it answers "am I neglecting this", where a fortnight is a fortnight
 * whatever the clock says. Here the words are the calendar's own, and a set
 * logged at 23:00 has to read `Yesterday` at 01:00 rather than `Today`. The
 * rounding is what makes that survive a DST boundary, where the gap between
 * two midnights is 23 or 25 hours.
 *
 * The counted words and the week they hand over at are `countedDays`'. What
 * stays here is what a History row does *after* the handover — print the date,
 * with the year along only when it is not this one, which on recent rows is
 * noise and on a row from December 2025 is the whole point.
 *
 * The counted days shorten to `3d` on a phone, borrowing `formatSince`'s
 * spelling rather than minting a second one — the app already says `9d` beside
 * an exercise, and a column that said `3 days ago` there would be two
 * vocabularies for one idea.
 *
 * A future timestamp reads as `Today` rather than counting backwards, the same
 * clock-skew guard `formatSince` carries and for the same reason: these records
 * arrive from other devices.
 */
export function formatWhen(then: number, now: number): When {
	const days = Math.round((startOfDay(now) - startOfDay(then)) / DAY);
	const counted = countedDays(days);

	if (counted !== null) {
		// The counted days lengthen on a desk and the two named ones do not:
		// `Today` is already two syllables, and `1 day ago` is a worse word than
		// the one everybody uses.
		return { short: counted, long: days < 2 ? counted : `${days} days ago` };
	}

	const sameYear = new Date(then).getFullYear() === new Date(now).getFullYear();
	const date = sameYear ? dayMonth.format(then) : dayMonthYear.format(then);

	return { short: date, long: `${weekday.format(then)}, ${date}` };
}
