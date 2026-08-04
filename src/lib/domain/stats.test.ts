import { describe, expect, test } from 'vitest';

import type { PastSession } from '$lib/domain/stats';
import { bestSet, estimated1Rm, rawPr } from '$lib/domain/stats';
import type { PerformedSet } from '$lib/domain/workout';

const session = (date: number, sets: PerformedSet[]): PastSession => ({
	date,
	workoutId: `w${date}`,
	position: 1,
	sets
});

const set = (weight: number, reps: number): PerformedSet => ({ weight, reps, rpe: null });

describe('bestSet', () => {
	test('no history is null, not a zero', () => {
		expect(bestSet([])).toBeNull();
	});

	test('heaviest weight wins regardless of reps', () => {
		expect(bestSet([set(100, 1), set(80, 12)])).toEqual(set(100, 1));
	});

	test('equal weight tie-breaks on reps', () => {
		expect(bestSet([set(100, 3), set(100, 5), set(100, 4)])).toEqual(set(100, 5));
	});

	test('a full tie keeps the first achievement', () => {
		const first = set(100, 5);

		expect(bestSet([first, set(100, 5)])).toBe(first);
	});
});

describe('estimated1Rm', () => {
	test('Epley: weight × (1 + reps ⁄ 30)', () => {
		expect(estimated1Rm(set(100, 5))).toBeCloseTo(116.67, 2);
	});

	test('a single estimates the weight itself, not weight × 31⁄30', () => {
		expect(estimated1Rm(set(140, 1))).toBe(140);
	});
});

describe('rawPr', () => {
	test('no sessions is null, not a zero', () => {
		expect(rawPr([])).toBeNull();
	});

	test('dates the PR to the session that set it, not the latest one', () => {
		const pr = rawPr([session(1, [set(100, 3)]), session(2, [set(90, 8)])]);

		expect(pr).toEqual({ set: set(100, 3), date: 1 });
	});

	test('matching the PR later does not move its date', () => {
		const pr = rawPr([session(1, [set(100, 5)]), session(2, [set(100, 5)])]);

		expect(pr!.date).toBe(1);
	});
});
