import { afterEach, describe, expect, test, vi } from 'vitest';

import { localDateOf } from '$lib/domain/bodyweight';
import { lastedOf, momentOf, retime, timeOf } from '$lib/domain/retime';
import type { Span } from '$lib/domain/retime';

const MINUTE = 60_000;

// Node rereads TZ on assignment, so each case runs on the clock it names.
function inZone(name: string): void {
	vi.stubEnv('TZ', name);
}

afterEach(() => {
	vi.unstubAllEnvs();
});

const at = (iso: string): number => Date.parse(iso);

const iso = (moment: number): string => new Date(moment).toISOString();

const span = (start: string, minutes: number): Span => ({
	startedAt: at(start),
	finishedAt: at(start) + minutes * MINUTE
});

describe('retime across a clock change', () => {
	test('Paris, into summer time: 18:00 stays 18:00 and the session lasts as long', () => {
		inZone('Europe/Paris');

		// 18:00 CET on the Saturday before the clocks go forward.
		const moved = retime(span('2026-03-28T17:00:00Z', 75), { date: '2026-03-29' });

		expect(iso(moved.startedAt)).toBe('2026-03-29T16:00:00.000Z');
		expect(timeOf(moved.startedAt)).toBe('18:00');
		expect(moved.finishedAt - moved.startedAt).toBe(75 * MINUTE);
	});

	test('Paris, back to winter time: 18:00 stays 18:00', () => {
		inZone('Europe/Paris');

		const moved = retime(span('2026-10-24T16:00:00Z', 60), { date: '2026-10-25' });

		expect(iso(moved.startedAt)).toBe('2026-10-25T17:00:00.000Z');
		expect(timeOf(moved.startedAt)).toBe('18:00');
		expect(moved.finishedAt - moved.startedAt).toBe(60 * MINUTE);
	});

	test('a wall time the clocks skip lands an hour later, and keeps its length', () => {
		inZone('Europe/Paris');

		// 02:30 CET a week earlier; 02:30 never happens on 29 March.
		const moved = retime(span('2026-03-22T01:30:00Z', 45), { date: '2026-03-29' });

		expect(localDateOf(new Date(moved.startedAt))).toBe('2026-03-29');
		expect(timeOf(moved.startedAt)).toBe('03:30');
		expect(moved.finishedAt - moved.startedAt).toBe(45 * MINUTE);
	});

	test('a session that spanned the change keeps its elapsed time, not its end on the wall', () => {
		inZone('Europe/Paris');

		// 01:30 CET to 04:00 CEST on the night the clocks went forward: ninety minutes.
		const moved = retime(span('2026-03-29T00:30:00Z', 90), { date: '2026-04-05' });

		expect(timeOf(moved.startedAt)).toBe('01:30');
		expect(timeOf(moved.finishedAt)).toBe('03:00');
		expect(moved.finishedAt - moved.startedAt).toBe(90 * MINUTE);
	});

	test('New York changes on its own date', () => {
		inZone('America/New_York');

		// 07:00 EST on the Saturday; 8 March is the first day of EDT.
		const moved = retime(span('2026-03-07T12:00:00Z', 50), { date: '2026-03-08' });

		expect(iso(moved.startedAt)).toBe('2026-03-08T11:00:00.000Z');
		expect(timeOf(moved.startedAt)).toBe('07:00');
	});

	test('Auckland goes back in April', () => {
		inZone('Pacific/Auckland');

		// 18:00 NZDT on 4 April; NZST from 5 April.
		const moved = retime(span('2026-04-04T05:00:00Z', 40), { date: '2026-04-05' });

		expect(iso(moved.startedAt)).toBe('2026-04-05T06:00:00.000Z');
		expect(timeOf(moved.startedAt)).toBe('18:00');
	});
});

describe('retime by the device clock', () => {
	test('a half-hour zone moves a whole day back on its own date, not UTC’s', () => {
		inZone('Asia/Kolkata');

		// 06:15 IST on 10 August is still 9 August in UTC.
		const moved = retime(span('2026-08-10T00:45:00Z', 30), { date: '2026-08-09' });

		expect(iso(moved.startedAt)).toBe('2026-08-09T00:45:00.000Z');
		expect(localDateOf(new Date(moved.startedAt))).toBe('2026-08-09');
	});

	test('UTC moves by whole days', () => {
		inZone('UTC');

		const moved = retime(span('2026-08-10T18:04:00Z', 70), { date: '2026-07-31' });

		expect(iso(moved.startedAt)).toBe('2026-07-31T18:04:00.000Z');
		expect(iso(moved.finishedAt)).toBe('2026-07-31T19:14:00.000Z');
	});

	test('a late session still ends after midnight on the day it moved to', () => {
		inZone('Europe/Paris');

		const moved = retime(span('2026-06-10T21:30:00Z', 60), { date: '2026-06-12' });

		expect(localDateOf(new Date(moved.startedAt))).toBe('2026-06-12');
		expect(timeOf(moved.startedAt)).toBe('23:30');
		expect(localDateOf(new Date(moved.finishedAt))).toBe('2026-06-13');
		expect(timeOf(moved.finishedAt)).toBe('00:30');
	});

	test('the seconds ride along when only the day changes', () => {
		inZone('Europe/Paris');

		const moved = retime(span('2026-06-10T16:04:37.250Z', 30), { date: '2026-06-03' });

		expect(iso(moved.startedAt)).toBe('2026-06-03T16:04:37.250Z');
	});

	test('its own day is no move at all', () => {
		inZone('Europe/Paris');

		const before = span('2026-06-10T16:04:37.250Z', 30);

		expect(retime(before, { date: '2026-06-10' })).toEqual(before);
		expect(retime(before, {})).toEqual(before);
	});

	test('a wall time named starts on the minute, and minutes reset the length', () => {
		inZone('Europe/Paris');

		const moved = retime(span('2026-06-10T16:04:37Z', 30), { time: '07:15', minutes: 90 });

		expect(iso(moved.startedAt)).toBe('2026-06-10T05:15:00.000Z');
		expect(moved.finishedAt - moved.startedAt).toBe(90 * MINUTE);
	});
});

describe('a record without a length', () => {
	test('an end before the start, or none, lasts nothing and moves as nothing', () => {
		inZone('Europe/Paris');

		const early = { startedAt: at('2026-06-10T16:00:00Z'), finishedAt: at('2026-06-10T15:00:00Z') };
		// What `undefined - startedAt` reads as, for a record imported without an end.
		const missing = { startedAt: at('2026-06-10T16:00:00Z'), finishedAt: Number.NaN };

		expect(lastedOf(early)).toBe(0);
		expect(lastedOf(missing)).toBe(0);

		const moved = retime(missing, { date: '2026-06-09' });

		expect(iso(moved.startedAt)).toBe('2026-06-09T16:00:00.000Z');
		expect(moved.finishedAt).toBe(moved.startedAt);
	});
});

describe('momentOf', () => {
	test('noon on the day the clocks go forward is noon, not one o’clock', () => {
		inZone('Europe/Paris');

		expect(iso(momentOf('2026-03-29', '12:00'))).toBe('2026-03-29T10:00:00.000Z');
	});
});
