/**
 * How a past workout introduces itself: the words the History list and detail
 * share, kept here so the two screens cannot describe the same session
 * differently. Plain TypeScript — strings out, no framework in.
 */

import { catalogById } from '$lib/catalog';
import type { Exercise } from '$lib/domain/exercise';
import type { Template } from '$lib/domain/template';
import type { Workout } from '$lib/domain/workout';

/**
 * The template's name when the template still exists; the session's own
 * contents when it does not. A deleted or never-had template is ordinary here
 * — templates are working documents and workouts outlive them — so the
 * fallback names what was actually done rather than apologising for a plan
 * that is gone. `'Untitled'` mirrors the Start list: a nameless template is a
 * record, and a blank title reads as a bug rather than a choice.
 */
export function workoutTitle(workout: Workout, templates: Template[]): string {
	const template = templates.find((candidate) => candidate.id === workout.templateId);

	if (template !== undefined) {
		return template.name.trim() === '' ? 'Untitled' : template.name;
	}

	const names: string[] = [];

	for (const exercise of workout.entries.flatMap((entry) => entry.exercises)) {
		// The widening annotation states what the map cannot: a stored id is any
		// string, so the join can miss. Skipped rather than named raw — a slug in
		// a title is a rendering bug, not information.
		const meta: Exercise | undefined = catalogById[exercise.exerciseId];

		if (meta !== undefined) {
			names.push(meta.name);
		}
	}

	if (names.length === 0) {
		return 'Workout';
	}

	return names.length === 1 ? names[0] : `${names[0]} + ${names.length - 1} more`;
}

/**
 * The sets that count, counted: completed working sets only, the same gate as
 * `performedSets` — CLAUDE.md's volume rule, restated as a tally. Warmups and
 * unchecked sets never count, and the null check is the sync boundary's, not
 * paranoia: these records also arrive from other devices.
 */
export function completedSetCount(workout: Workout): number {
	let count = 0;

	for (const entry of workout.entries) {
		for (const exercise of entry.exercises) {
			for (const set of exercise.sets) {
				if (set.completed && set.type !== 'warmup' && set.weight !== null && set.reps !== null) {
					count += 1;
				}
			}
		}
	}

	return count;
}

/**
 * The exercises a session held, counted the way the detail screen draws them:
 * every exercise node, so a superset of two counts two and the same exercise
 * performed twice in one session counts twice. What the number promises is how
 * many blocks are behind the row, and a tally that deduplicated would promise
 * something the screen then contradicts.
 *
 * Unlike the set count this takes no completion gate: an exercise that was
 * opened and abandoned is still one of the things that happened that day, and
 * the record keeps it — see the detail screen, which shows unchecked sets for
 * the same reason.
 */
export function exerciseCount(workout: Workout): number {
	let count = 0;

	for (const entry of workout.entries) {
		count += entry.exercises.length;
	}

	return count;
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

	// Nine weeks, not eight: the handover lands at 63 days, past the ~61 that
	// the first month figure below would claim, so the two scales never step
	// backwards across the seam.
	if (days < 63) {
		return `${Math.floor(days / 7)}w`;
	}

	return `${Math.floor(days / 30)}mo`;
}

/**
 * The two spellings of one date: what the History row prints on a phone, and
 * what it prints once there is room. Both are returned together because they
 * are the same fact — the row renders both and lets CSS pick at `lg`, which is
 * the only width in this app where anything changes shape.
 */
export type When = { short: string; long: string };

// One instance each, at module scope: `Intl.DateTimeFormat` is the expensive
// part of formatting, and a list is hundreds of rows.
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const dayMonthYear = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'short',
	year: 'numeric'
});
// The weekday alone, joined on by hand below. Asking Intl for it inline gives
// `Mon 12 Jan` without a year and `Mon, 12 Jan 2026` with one — en-GB's own
// comma rule, and a column where half the rows carry a comma reads as a bug.
const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });

/** Local midnight before `ms`. The calendar day is the unit, not the clock. */
function startOfDay(ms: number): number {
	const date = new Date(ms);

	date.setHours(0, 0, 0, 0);

	return date.getTime();
}

/**
 * When a session happened, in the words a lifter would use for it: `Today`,
 * `Yesterday`, `3 days ago`, and a date once counting stops being an answer.
 *
 * Calendar days, unlike `formatSince` above — that one measures elapsed time
 * because it answers "am I neglecting this", where a fortnight is a fortnight
 * whatever the clock says. Here the words are the calendar's own, and a set
 * logged at 23:00 has to read `Yesterday` at 01:00 rather than `Today`. The
 * rounding is what makes that survive a DST boundary, where the gap between
 * two midnights is 23 or 25 hours.
 *
 * The handover is a week: `6 days ago` is still countable, `9 days ago` is a
 * number you convert to a date anyway, so the row shows the date instead. The
 * year rides along only when it is not this one — on recent rows it is noise,
 * and on a row from December 2025 it is the whole point.
 *
 * A future timestamp reads as `Today` rather than counting backwards, the same
 * clock-skew guard `formatSince` carries and for the same reason: these records
 * arrive from other devices.
 */
export function formatWhen(then: number, now: number): When {
	const days = Math.round((startOfDay(now) - startOfDay(then)) / DAY);

	if (days < 1) {
		return { short: 'Today', long: 'Today' };
	}

	if (days === 1) {
		return { short: 'Yesterday', long: 'Yesterday' };
	}

	if (days < 7) {
		const said = `${days} days ago`;

		return { short: said, long: said };
	}

	const sameYear = new Date(then).getFullYear() === new Date(now).getFullYear();
	const date = sameYear ? dayMonth.format(then) : dayMonthYear.format(then);

	return { short: date, long: `${weekday.format(then)}, ${date}` };
}
