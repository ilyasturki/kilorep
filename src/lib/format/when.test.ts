import { describe, expect, it } from 'vitest';

import { countedDays, syncedWhen } from './when.ts';

describe('countedDays', () => {
	it('names today and yesterday, counts the rest of the week, then gives up', () => {
		expect(countedDays(0)).toBe('Today');
		expect(countedDays(1)).toBe('Yesterday');
		expect(countedDays(3)).toBe('3d');
		expect(countedDays(7)).toBeNull();
	});
});

describe('syncedWhen', () => {
	const at = new Date(2026, 7, 20, 10, 42).getTime();

	it('calls the last minute now', () => {
		expect(syncedWhen(at, at + 30_000)).toBe('just now');
	});

	it('counts minutes for the first hour', () => {
		expect(syncedWhen(at, at + 12 * 60_000)).toBe('12m ago');
		expect(syncedWhen(at, at + 59 * 60_000)).toBe('59m ago');
	});

	it('gives the clock time once it is earlier today', () => {
		expect(syncedWhen(at, new Date(2026, 7, 20, 18, 0).getTime())).toBe('10:42');
	});

	// Two hours apart across midnight is yesterday, not "2h" — the day is what the
	// lifter reads, and a session logged last night is the thing being asked about.
	it('says yesterday by the calendar, not by the count of hours', () => {
		expect(
			syncedWhen(new Date(2026, 7, 19, 23, 30).getTime(), new Date(2026, 7, 20, 1, 30).getTime())
		).toBe('yesterday 23:30');
	});

	it('falls back to a date once the days stop meaning anything', () => {
		expect(syncedWhen(at, new Date(2026, 7, 28, 9, 0).getTime())).toBe('20 Aug');
	});

	// A phone whose clock has been pushed back reads the stamp as being in the future.
	it('never reports a stamp from the future as an age', () => {
		expect(syncedWhen(at, at - 60_000)).toBe('just now');
	});
});
