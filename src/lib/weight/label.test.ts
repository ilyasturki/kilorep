import { describe, expect, test } from 'vitest';

import { formatLogDay, formatMonth, formatMonthMeta, formatSheetDay } from '$lib/weight/label';

// Wednesday 5 August 2026, which is what every relative case below counts from.
const today = '2026-08-05';

describe('formatLogDay', () => {
	test('counts the recent days in History’s words', () => {
		expect(formatLogDay('2026-08-05', today)).toBe('Today');
		expect(formatLogDay('2026-08-04', today)).toBe('Yesterday');
		expect(formatLogDay('2026-08-03', today)).toBe('2d');
	});

	test('hands over to a weekday at a week, where counting stops answering', () => {
		expect(formatLogDay('2026-07-30', today)).toBe('6d');
		expect(formatLogDay('2026-07-29', today)).toBe('Wed 29');
	});

	test('names the weekday and the day alone — the group header carries the month', () => {
		expect(formatLogDay('2026-07-01', today)).toBe('Wed 1');
		expect(formatLogDay('2025-12-25', today)).toBe('Thu 25');
	});

	test('a future date reads as Today rather than counting backwards', () => {
		// Records arrive from other devices, and two phones a minute apart must
		// not print `-1d`.
		expect(formatLogDay('2026-08-06', today)).toBe('Today');
	});
});

describe('formatSheetDay', () => {
	test('never counts, and punctuates the same way with or without a year', () => {
		expect(formatSheetDay('2026-08-05', today)).toBe('Wed, 5 Aug');
		expect(formatSheetDay('2026-08-04', today)).toBe('Tue, 4 Aug');
	});

	test('carries the year only when it is not this one', () => {
		expect(formatSheetDay('2026-01-02', today)).toBe('Fri, 2 Jan');
		expect(formatSheetDay('2025-12-25', today)).toBe('Thu, 25 Dec 2025');
	});
});

describe('formatMonth', () => {
	test('a YYYY-MM key as its header reads', () => {
		expect(formatMonth('2026-08')).toBe('Aug 2026');
	});
});

describe('formatMonthMeta', () => {
	test('one decimal on both numbers, which is what a scale claims', () => {
		expect(formatMonthMeta(82.44, -0.62)).toBe('avg 82.4 · −0.6');
		expect(formatMonthMeta(82, 1.25)).toBe('avg 82.0 · +1.3');
	});

	test('the oldest month has nothing to compare against', () => {
		expect(formatMonthMeta(83.95, null)).toBe('avg 84.0');
	});

	test('a month that did not move says so — a +0.0 reads as a gain', () => {
		expect(formatMonthMeta(82.4, 0)).toBe('avg 82.4 · ±0.0');
		expect(formatMonthMeta(82.4, -0.02)).toBe('avg 82.4 · ±0.0');
	});
});
