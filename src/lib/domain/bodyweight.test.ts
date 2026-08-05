import { describe, expect, test } from 'vitest';

import {
	addDays,
	bodyweightId,
	daysBetween,
	inRange,
	isChartRange,
	localDateOf,
	monthGroups,
	rangeStart,
	rollingAverage,
	weeklyRate,
	windowed
} from '$lib/domain/bodyweight';

describe('bodyweightId', () => {
	test('one day mints one id, so re-logging is an overwrite by construction', () => {
		expect(bodyweightId('2026-08-02')).toBe(bodyweightId('2026-08-02'));
		expect(bodyweightId('2026-08-02')).not.toBe(bodyweightId('2026-08-03'));
	});
});

describe('localDateOf', () => {
	test('reads the clock local, zero-padded', () => {
		expect(localDateOf(new Date(2026, 7, 2, 0, 30))).toBe('2026-08-02');
		expect(localDateOf(new Date(2026, 0, 5))).toBe('2026-01-05');
	});
});

describe('addDays', () => {
	test('crosses a month and a year without a clock', () => {
		expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
		expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
		expect(addDays('2026-08-02', -83)).toBe('2026-05-11');
	});
});

describe('rollingAverage', () => {
	test('no entries is no trend, not a zero', () => {
		expect(rollingAverage([])).toEqual([]);
	});

	test('a lone entry is its own average', () => {
		expect(rollingAverage([{ date: '2026-08-02', kg: 80 }])).toEqual([
			{ date: '2026-08-02', kg: 80 }
		]);
	});

	test('averages the trailing seven calendar days, inclusive', () => {
		const trend = rollingAverage([
			{ date: '2026-07-27', kg: 82 },
			{ date: '2026-08-02', kg: 80 }
		]);

		expect(trend[1].kg).toBe(81);
	});

	test('a day outside the window has no say', () => {
		const trend = rollingAverage([
			{ date: '2026-07-26', kg: 90 },
			{ date: '2026-08-02', kg: 80 }
		]);

		expect(trend[1].kg).toBe(80);
	});

	test('a gap thins the window rather than stretching it', () => {
		const trend = rollingAverage([
			{ date: '2026-07-01', kg: 84 },
			{ date: '2026-07-02', kg: 83 },
			{ date: '2026-07-23', kg: 81 }
		]);

		expect(trend.map((point) => point.kg)).toEqual([84, 83.5, 81]);
	});
});

describe('windowed', () => {
	const entries = [
		{ date: '2026-05-10', kg: 84 },
		{ date: '2026-05-11', kg: 83.6 },
		{ date: '2026-08-02', kg: 80 }
	];

	test('keeps the last N days ending today, inclusive both ends', () => {
		expect(windowed(entries, '2026-08-02', 84)).toEqual([
			{ date: '2026-05-11', kg: 83.6 },
			{ date: '2026-08-02', kg: 80 }
		]);
	});

	test('a future-dated entry never leaks in', () => {
		expect(windowed(entries, '2026-05-11', 84)).toEqual([
			{ date: '2026-05-10', kg: 84 },
			{ date: '2026-05-11', kg: 83.6 }
		]);
	});
});

describe('weeklyRate', () => {
	test('under fourteen days of span the answer is null, not a guess', () => {
		expect(weeklyRate([])).toBeNull();
		expect(
			weeklyRate([
				{ date: '2026-07-01', kg: 80 },
				{ date: '2026-07-13', kg: 79 }
			])
		).toBeNull();
	});

	test('kilograms per week, signed, first point to last', () => {
		expect(
			weeklyRate([
				{ date: '2026-07-01', kg: 80 },
				{ date: '2026-07-15', kg: 79.4 },
				{ date: '2026-07-29', kg: 78.8 }
			])
		).toBeCloseTo(-0.3, 5);
	});
});

describe('daysBetween', () => {
	test('counts calendar days in the direction it is asked', () => {
		expect(daysBetween('2026-08-02', '2026-08-05')).toBe(3);
		expect(daysBetween('2026-08-05', '2026-08-02')).toBe(-3);
		expect(daysBetween('2026-08-05', '2026-08-05')).toBe(0);
	});

	test('a DST boundary is still one day, not 0.96 of one', () => {
		// Europe's spring forward, where two local midnights are 23 hours apart.
		expect(daysBetween('2026-03-28', '2026-03-29')).toBe(1);
		expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
	});
});

describe('isChartRange', () => {
	test('guards a preference that arrived over the wire', () => {
		expect(isChartRange('6mo')).toBe(true);
		expect(isChartRange('3w')).toBe(false);
		expect(isChartRange(null)).toBe(false);
		expect(isChartRange(84)).toBe(false);
	});
});

describe('rangeStart', () => {
	const log = [
		{ date: '2024-01-10', kg: 90 },
		{ date: '2026-08-05', kg: 82 }
	];

	test('a fixed range counts back from today, inclusive of both ends', () => {
		expect(rangeStart(log, '2026-08-05', '12w')).toBe('2026-05-14');
	});

	test('all opens on the first weigh-in ever', () => {
		expect(rangeStart(log, '2026-08-05', 'all')).toBe('2024-01-10');
	});

	test('all on an empty log is today, not a chart with no domain', () => {
		expect(rangeStart([], '2026-08-05', 'all')).toBe('2026-08-05');
	});
});

describe('inRange', () => {
	const log = [
		{ date: '2024-01-10', kg: 90 },
		{ date: '2026-05-13', kg: 84 },
		{ date: '2026-05-14', kg: 83 },
		{ date: '2026-08-05', kg: 82 }
	];

	test('a fixed range cuts at its own edge', () => {
		expect(inRange(log, '2026-08-05', '12w').map((entry) => entry.date)).toEqual([
			'2026-05-14',
			'2026-08-05'
		]);
	});

	test('all keeps everything, including the day before the oldest cut', () => {
		expect(inRange(log, '2026-08-05', 'all')).toHaveLength(4);
	});

	test('a future entry is never drawn — two devices can disagree about the clock', () => {
		expect(inRange(log, '2026-05-14', 'all').map((entry) => entry.date)).toEqual([
			'2024-01-10',
			'2026-05-13',
			'2026-05-14'
		]);
	});
});

describe('monthGroups', () => {
	const log = [
		{ date: '2026-06-10', kg: 84 },
		{ date: '2026-06-20', kg: 84 },
		{ date: '2026-07-01', kg: 83 },
		{ date: '2026-07-31', kg: 83 },
		{ date: '2026-08-05', kg: 82.4 }
	];

	test('no entries is no groups', () => {
		expect(monthGroups([])).toEqual([]);
	});

	test('newest month first, and newest day first inside it', () => {
		const groups = monthGroups(log);

		expect(groups.map((group) => group.month)).toEqual(['2026-08', '2026-07', '2026-06']);
		expect(groups[1].entries.map((entry) => entry.date)).toEqual(['2026-07-31', '2026-07-01']);
	});

	test('the average is the month, not its last morning', () => {
		const groups = monthGroups([
			{ date: '2026-08-01', kg: 80 },
			{ date: '2026-08-02', kg: 84 }
		]);

		expect(groups[0].average).toBe(82);
	});

	test('change is average against average, and null on the oldest month', () => {
		const groups = monthGroups(log);

		expect(groups[0].change).toBeCloseTo(-0.6, 5);
		expect(groups[1].change).toBe(-1);
		expect(groups[2].change).toBeNull();
	});

	test('a skipped month compares against the previous group, not a gap', () => {
		const groups = monthGroups([
			{ date: '2026-06-10', kg: 90 },
			{ date: '2026-08-10', kg: 88 }
		]);

		expect(groups.map((group) => group.month)).toEqual(['2026-08', '2026-06']);
		expect(groups[0].change).toBe(-2);
	});

	test('a year boundary is two groups, not one August', () => {
		const groups = monthGroups([
			{ date: '2025-08-10', kg: 90 },
			{ date: '2026-08-10', kg: 88 }
		]);

		expect(groups.map((group) => group.month)).toEqual(['2026-08', '2025-08']);
	});
});
