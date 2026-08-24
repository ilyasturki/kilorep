import { describe, expect, test } from 'vitest';

import type { CarriedOn } from '$lib/domain/load';
import type { PastSession } from '$lib/domain/stats';
import { bestEstimate, bestSet, estimated1Rm, loadForReps, rawPr } from '$lib/domain/stats';
import type { PerformedSet } from '$lib/domain/workout';

const session = (date: number, sets: PerformedSet[]): PastSession => ({
	date,
	workoutId: `w${date}`,
	position: 1,
	sets
});

const set = (weight: number, reps: number): PerformedSet => ({ weight, reps, rpe: null });

const gaining: CarriedOn = (at) => (at === 1 ? 78 : 82);

const cutting: CarriedOn = (at) => (at === 1 ? 82 : 70);

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
		expect(estimated1Rm(set(100, 5), 0)).toBeCloseTo(116.67, 2);
	});

	test('a single estimates the weight itself, not weight × 31⁄30', () => {
		expect(estimated1Rm(set(140, 1), 0)).toBe(140);
	});

	test('the body carried is estimated from too, not added to the estimate', () => {
		expect(estimated1Rm(set(10, 5), 78)).toBeCloseTo(88 * (1 + 5 / 30), 5);
	});

	test('a pull-up with nothing on the belt still estimates a 1RM', () => {
		expect(estimated1Rm(set(0, 8), 78)).toBeCloseTo(78 * (1 + 8 / 30), 5);
	});
});

describe('rawPr', () => {
	test('no sessions is null, not a zero', () => {
		expect(rawPr([], () => 0)).toBeNull();
	});

	test('dates the PR to the session that set it, not the latest one', () => {
		const pr = rawPr([session(1, [set(100, 3)]), session(2, [set(90, 8)])], () => 0);

		expect(pr).toEqual({ set: set(100, 3), date: 1, load: 100 });
	});

	test('matching the PR later does not move its date', () => {
		const pr = rawPr([session(1, [set(100, 5)]), session(2, [set(100, 5)])], () => 0);

		expect(pr!.date).toBe(1);
	});

	test('load is what moved and the set keeps what was added', () => {
		const pr = rawPr([session(1, [set(10, 8)])], () => 78);

		expect(pr).toEqual({ set: set(10, 8), date: 1, load: 88 });
	});

	test('a heavier lifter at the same belt does not take the best', () => {
		const pr = rawPr([session(1, [set(10, 8)]), session(2, [set(10, 8)])], gaining);

		expect(pr).toMatchObject({ date: 1, load: 88 });
	});

	test('with nothing ever on the belt the reps decide, not the weigh-in', () => {
		const pr = rawPr([session(1, [set(0, 8)]), session(2, [set(0, 5)])], gaining);

		expect(pr).toMatchObject({ set: set(0, 8), date: 1 });
	});

	test('the belt outranks the reps the day something goes on it', () => {
		const pr = rawPr([session(1, [set(0, 12)]), session(2, [set(5, 3)])], gaining);

		expect(pr).toMatchObject({ set: set(5, 3), date: 2, load: 87 });
	});

	// The deliberate half of the rule, and the one a reader would call a bug: `load` is what the
	// winner moved and not the most ever moved, so a lifter eight kilos down at five on the belt
	// takes the best off a heavier day that hung nothing on it.
	test('the belt still leads when the day it was worn moved less', () => {
		const pr = rawPr([session(1, [set(0, 12)]), session(2, [set(5, 3)])], cutting);

		expect(pr).toMatchObject({ set: set(5, 3), date: 2, load: 75 });
	});
});

describe('bestEstimate', () => {
	test('no sessions is null, not a zero', () => {
		expect(bestEstimate([], () => 0)).toBeNull();
	});

	test('the day that estimates highest wins, not the day that lifted heaviest', () => {
		const past = [session(1, [set(100, 3)]), session(2, [set(90, 10)])];

		expect(rawPr(past, () => 0)!.date).toBe(1);
		expect(bestEstimate(past, () => 0)!.date).toBe(2);
	});

	test('names the set inside the session, not just the day', () => {
		const best = bestEstimate([session(1, [set(60, 5), set(90, 10), set(80, 6)])], () => 0);

		expect(best).toMatchObject({ set: set(90, 10), date: 1 });
	});

	test('matching an estimate later does not move its date', () => {
		const past = [session(1, [set(100, 5)]), session(2, [set(100, 5)])];

		expect(bestEstimate(past, () => 0)!.date).toBe(1);
	});

	test('the body carried counts toward the estimate', () => {
		const best = bestEstimate([session(1, [set(0, 8)])], () => 78);

		expect(best!.est).toBeCloseTo(78 * (1 + 8 / 30), 5);
	});
});

describe('loadForReps', () => {
	test('inverts Epley: what five reps have to move to estimate the same', () => {
		const est = estimated1Rm(set(100, 5), 0);

		expect(loadForReps(est, 5)).toBeCloseTo(100, 5);
	});

	test('a single moves the estimate itself', () => {
		expect(loadForReps(140, 1)).toBe(140);
	});

	test('more reps ask for less on the bar', () => {
		expect(loadForReps(120, 8)).toBeLessThan(loadForReps(120, 3));
	});
});
