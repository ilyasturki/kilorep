import { describe, expect, test } from 'vitest';

import type { PastSession } from '$lib/domain/stats';
import { bestSet, estimated1Rm, rawPr } from '$lib/domain/stats';
import type { PerformedSet } from '$lib/domain/workout';

// `rawPr` never reads the workout link or the ordinal; dummies keep the
// literals below about what the tests are about.
const session = (date: number, sets: PerformedSet[]): PastSession => ({
	date,
	workoutId: `w${date}`,
	position: 1,
	sets
});

describe('bestSet', () => {
	test('no history is null, not a zero', () => {
		expect(bestSet([])).toBeNull();
	});

	test('heaviest weight wins regardless of reps', () => {
		expect(
			bestSet([
				{ weight: 100, reps: 1 },
				{ weight: 80, reps: 12 }
			])
		).toEqual({ weight: 100, reps: 1 });
	});

	test('equal weight tie-breaks on reps', () => {
		expect(
			bestSet([
				{ weight: 100, reps: 3 },
				{ weight: 100, reps: 5 },
				{ weight: 100, reps: 4 }
			])
		).toEqual({ weight: 100, reps: 5 });
	});

	test('a full tie keeps the first achievement', () => {
		const first = { weight: 100, reps: 5 };

		expect(bestSet([first, { weight: 100, reps: 5 }])).toBe(first);
	});
});

describe('estimated1Rm', () => {
	test('Epley: weight × (1 + reps ⁄ 30)', () => {
		expect(estimated1Rm({ weight: 100, reps: 5 })).toBeCloseTo(116.67, 2);
	});

	test('a single estimates the weight itself, not weight × 31⁄30', () => {
		expect(estimated1Rm({ weight: 140, reps: 1 })).toBe(140);
	});
});

describe('rawPr', () => {
	test('no sessions is null, not a zero', () => {
		expect(rawPr([])).toBeNull();
	});

	test('dates the PR to the session that set it, not the latest one', () => {
		const pr = rawPr([
			session(1, [{ weight: 100, reps: 3 }]),
			session(2, [{ weight: 90, reps: 8 }])
		]);

		expect(pr).toEqual({ set: { weight: 100, reps: 3 }, date: 1 });
	});

	test('matching the PR later does not move its date', () => {
		const pr = rawPr([
			session(1, [{ weight: 100, reps: 5 }]),
			session(2, [{ weight: 100, reps: 5 }])
		]);

		expect(pr!.date).toBe(1);
	});
});
