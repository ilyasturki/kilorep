import { daysBetween } from '$lib/domain/bodyweight';
import { countedDays } from '$lib/format/when';

// UTC throughout: `Date.parse` reads a date-only string as UTC midnight, so a
// local-time format would print the day before in negative-offset zones.
const enGB = (options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
	new Intl.DateTimeFormat('en-GB', options);

const weekdayDay = enGB({ weekday: 'short', day: 'numeric', timeZone: 'UTC' });

const weekday = enGB({ weekday: 'short', timeZone: 'UTC' });

const dayMonth = enGB({ day: 'numeric', month: 'short', timeZone: 'UTC' });

const dayMonthYear = enGB({ day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const monthYear = enGB({ month: 'short', year: 'numeric', timeZone: 'UTC' });

export function formatLogDay(date: string, today: string): string {
	const counted = countedDays(daysBetween(date, today));

	return counted ?? weekdayDay.format(Date.parse(date));
}

export function formatSheetDay(date: string, today: string): string {
	const at = Date.parse(date);
	const format = date.slice(0, 4) === today.slice(0, 4) ? dayMonth : dayMonthYear;

	return `${weekday.format(at)}, ${format.format(at)}`;
}

export function formatMonth(month: string): string {
	return monthYear.format(Date.parse(`${month}-01`));
}

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
