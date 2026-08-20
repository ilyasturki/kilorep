import { describe, expect, test } from 'vitest';

import type { BodyweightEntry } from '$lib/domain/bodyweight';
import type { Exercise } from '$lib/domain/exercise';
import { bodyweightOn, bodyweightShareOf, carriedFrom } from '$lib/domain/load';

const log: BodyweightEntry[] = [
	{ date: '2026-03-01', kg: 78 },
	{ date: '2026-05-14', kg: 80 },
	{ date: '2026-08-19', kg: 82 }
];

const barbell = (id: string): Exercise => ({
	id,
	name: id,
	aliases: [],
	equipment: 'Barbell',
	loadMode: 'total',
	muscles: { primary: 'Back', secondary: [] }
});

const carrying = (id: string, bodyweightShare: number): Exercise => ({
	id,
	name: id,
	aliases: [],
	equipment: 'Bodyweight',
	loadMode: 'total',
	muscles: { primary: 'Back', secondary: [] },
	bodyweightShare
});

const byId = new Map<string, Exercise>([
	['pull-up', carrying('pull-up', 1)],
	['push-up', carrying('push-up', 0.65)],
	['plank', carrying('plank', 0)]
]);

const catalogue = (id: string): Exercise | undefined => byId.get(id);

// Local noon, so no time zone can push the stamp onto the day either side.
const noon = (date: string): number => {
	const [year, month, day] = date.split('-').map(Number);

	return new Date(year, month - 1, day, 12).getTime();
};

describe('bodyweightShareOf', () => {
	test('an exercise without one carries nothing', () => {
		expect(bodyweightShareOf(barbell('bench-press'))).toBe(0);
	});

	test('an exercise the catalogue has never heard of carries nothing', () => {
		expect(bodyweightShareOf(byId.get('mystery-custom'))).toBe(0);
	});
});

describe('bodyweightOn', () => {
	test('the weigh-in of the day itself', () => {
		expect(bodyweightOn(log, '2026-05-14')).toBe(80);
	});

	test('the latest one before it where the day has none', () => {
		expect(bodyweightOn(log, '2026-06-30')).toBe(80);
	});

	test('null before the first weigh-in, never that first one projected backwards', () => {
		expect(bodyweightOn(log, '2026-02-28')).toBeNull();
	});

	test('an empty log is null rather than a zero', () => {
		expect(bodyweightOn([], '2026-05-14')).toBeNull();
	});
});

describe('carriedFrom', () => {
	const carried = carriedFrom(log, catalogue);

	test('a partial share carries its part of it', () => {
		expect(carried('push-up', noon('2026-08-19'))).toBeCloseTo(53.3, 5);
	});

	test('a zero share carries nothing, however heavy the lifter', () => {
		expect(carried('plank', noon('2026-08-19'))).toBe(0);
	});

	test('a session from before the first weigh-in carries nothing', () => {
		expect(carried('pull-up', noon('2026-01-05'))).toBe(0);
	});

	test('the day of the session is read, not the latest weigh-in', () => {
		expect(carried('pull-up', noon('2026-03-02'))).toBe(78);
		expect(carried('pull-up', noon('2026-08-19'))).toBe(82);
	});
});
