import { daysBetween } from '$lib/domain/bodyweight';
import { countedDays } from '$lib/format/when';

/**
 * Every formatter here is UTC over date-only strings. A weigh-in's date is
 * timezone-less — `2026-08-05` is that day everywhere — and `Date.parse` reads
 * it as UTC midnight, so a local-time format in a negative-offset zone would
 * print the row as the day before. This is the same reason the domain's
 * calendar arithmetic runs through `Date.UTC`.
 */
const enGB = (options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
	new Intl.DateTimeFormat('en-GB', options);

const weekdayDay = enGB({ weekday: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * Composed rather than asked for in one pattern, and the comma is why: en-GB
 * writes `Wed 5 Aug` without one and `Thu, 25 Dec 2025` with, so a single
 * formatter per shape would punctuate the same sentence two ways depending on
 * whether the year came along. Joined by hand it reads the way History's long
 * form does, which is where the comma comes from.
 */
const weekday = enGB({ weekday: 'short', timeZone: 'UTC' });

const dayMonth = enGB({ day: 'numeric', month: 'short', timeZone: 'UTC' });

const dayMonthYear = enGB({ day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const monthYear = enGB({ month: 'short', year: 'numeric', timeZone: 'UTC' });

/**
 * A row in the log, in the words History already uses for a session: `Today`,
 * `Yesterday`, `3d`, and then `Sun 2`.
 *
 * The weekday-and-day is where this parts from History, and the month header
 * above the row is why: it has already said August 2026, so a row repeating it
 * would be the same two words on every line of the group. What the weekday buys
 * instead is real on a log weighed daily — a Sunday two kilos above its week is
 * a story, and a bare `2` is not.
 *
 * One spelling, not History's short/long pair. That pair exists because a
 * History row has a whole desk window to spread into; the Weight log's column
 * is *narrower* on a desk than on a phone — it shares the width with the chart
 * — so there is no wider spelling to swap in.
 */
export function formatLogDay(date: string, today: string): string {
	const counted = countedDays(daysBetween(date, today));

	return counted ?? weekdayDay.format(Date.parse(date));
}

/**
 * The same day named in full, for the edit sheet — which floats free of the
 * group that would otherwise have said the month, and is about to overwrite or
 * delete the record for one specific day. `Today` is not a good enough answer
 * to "which day am I deleting", so this one never counts: it always spells the
 * date, and carries the year when it is not the current one.
 */
export function formatSheetDay(date: string, today: string): string {
	const at = Date.parse(date);
	const format = date.slice(0, 4) === today.slice(0, 4) ? dayMonth : dayMonthYear;

	return `${weekday.format(at)}, ${format.format(at)}`;
}

/** A `YYYY-MM` group key as its header reads: `Aug 2026`. */
export function formatMonth(month: string): string {
	return monthYear.format(Date.parse(`${month}-01`));
}

/**
 * A month's average, and the ± beside it. One decimal on both, because that is
 * the precision the scale itself claims and a second one would be inventing
 * confidence the number does not have.
 *
 * A true minus sign rather than a hyphen, matching the Dashboard's rate line.
 * `0.0` is written as `±` and not `+0.0`: a plus on a month that did not move
 * reads as a gain until you get to the digits.
 */
export function formatMonthMeta(average: number, change: number | null): string {
	const avg = `avg ${(Math.round(average * 10) / 10).toFixed(1)}`;

	if (change === null) {
		return avg;
	}

	const rounded = Math.round(change * 10) / 10;

	if (rounded === 0) {
		return `${avg} · ±0.0`;
	}

	return `${avg} · ${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1)}`;
}
