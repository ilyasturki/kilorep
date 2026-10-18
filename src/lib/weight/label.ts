import { daysBetween } from '$lib/domain/bodyweight';
import type { RangeStats } from '$lib/domain/bodyweight';
import { dateFormat, numberFormat } from '$lib/format/locale';
import { countedDays } from '$lib/format/when';

// UTC throughout: `Date.parse` reads a date-only string as UTC midnight, so a
// local-time format would print the day before in negative-offset zones.
const weekdayDay = dateFormat({ weekday: 'short', day: 'numeric', timeZone: 'UTC' });

const weekday = dateFormat({ weekday: 'short', timeZone: 'UTC' });

const dayMonth = dateFormat({ day: 'numeric', month: 'short', timeZone: 'UTC' });

const dayMonthYear = dateFormat({
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	timeZone: 'UTC'
});

const monthYear = dateFormat({ month: 'short', year: 'numeric', timeZone: 'UTC' });

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

const ONE_PLACE = numberFormat({ minimumFractionDigits: 1, maximumFractionDigits: 1 });

const tenth = (kg: number): string => ONE_PLACE.format(Math.round(kg * 10) / 10);

function signed(change: number): string {
	const rounded = Math.round(change * 10) / 10;

	if (rounded === 0) {
		return `±${tenth(0)}`;
	}

	return `${rounded > 0 ? '+' : '−'}${tenth(Math.abs(rounded))}`;
}

export function formatMonthMeta(average: number, change: number | null): string {
	const avg = `avg ${tenth(average)}`;

	return change === null ? avg : `${avg} · ${signed(change)}`;
}

export function formatRangeStats({ change, lowest, highest }: RangeStats): string {
	const extremes = `low ${tenth(lowest.kg)} · high ${tenth(highest.kg)}`;

	return change === null ? extremes : `${signed(change)} kg · ${extremes}`;
}
