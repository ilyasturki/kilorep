import { describe, expect, test } from 'vitest';

import {
	addDays,
	bodyweightId,
	localDateOf,
	rollingAverage,
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
		// Local-component constructor, so the expectation holds in every timezone
		// the suite runs in.
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
			// Exactly six days before the last point: inside the window.
			{ date: '2026-07-27', kg: 82 },
			{ date: '2026-08-02', kg: 80 }
		]);

		expect(trend[1].kg).toBe(81);
	});

	test('a day outside the window has no say', () => {
		const trend = rollingAverage([
			// Seven days before: one past the edge.
			{ date: '2026-07-26', kg: 90 },
			{ date: '2026-08-02', kg: 80 }
		]);

		expect(trend[1].kg).toBe(80);
	});

	test('a gap thins the window rather than stretching it', () => {
		const trend = rollingAverage([
			{ date: '2026-07-01', kg: 84 },
			{ date: '2026-07-02', kg: 83 },
			// Three weeks of nothing logged.
			{ date: '2026-07-23', kg: 81 }
		]);

		// The July points average each other; the late one rests on itself alone.
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
		// 84 days ending 2026-08-02 reach back to 2026-05-11 exactly.
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
