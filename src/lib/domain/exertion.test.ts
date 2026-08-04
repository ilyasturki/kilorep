import { describe, expect, test } from 'vitest';

import {
	EXERTION_MAX,
	EXERTION_MIN,
	EXERTION_RUNGS,
	exertionLabel,
	exertionSuffix,
	isExertion,
	scaleName,
	settleExertion,
	shownExertion,
	shownMax,
	shownMin,
	storedExertion
} from '$lib/domain/exertion';

describe('settleExertion', () => {
	test('rounds to the half step the chips and the arms both move in', () => {
		expect(settleExertion(8.24)).toBe(8);
		expect(settleExertion(8.26)).toBe(8.5);
		expect(settleExertion(8.75)).toBe(9);
	});

	test('clamps to the scale rather than storing what it was handed', () => {
		expect(settleExertion(99)).toBe(EXERTION_MAX);
		expect(settleExertion(-4)).toBe(EXERTION_MIN);
	});

	test('every rung survives its own settling', () => {
		for (const rung of EXERTION_RUNGS) {
			expect(settleExertion(rung)).toBe(rung);
		}
	});
});

describe('isExertion', () => {
	test('a number is a rating and nothing else is', () => {
		expect(isExertion(8)).toBe(true);
		expect(isExertion(0)).toBe(true);
		expect(isExertion('8')).toBe(false);
		expect(isExertion(null)).toBe(false);
	});

	test('a field that was never written is not a rating', () => {
		const legacy: { rpe?: number } = {};

		expect(isExertion(legacy.rpe)).toBe(false);
	});

	test('NaN is not a rating', () => {
		expect(isExertion(Number.NaN)).toBe(false);
		expect(isExertion(Number.POSITIVE_INFINITY)).toBe(false);
	});
});

describe('the two scales', () => {
	test('RPE shows what is stored', () => {
		expect(shownExertion(8, 'rpe')).toBe(8);
		expect(storedExertion(8, 'rpe')).toBe(8);
	});

	test('RIR reads the same number from the other end', () => {
		expect(shownExertion(8, 'rir')).toBe(2);
		expect(shownExertion(9.5, 'rir')).toBe(0.5);
		expect(shownExertion(10, 'rir')).toBe(0);
	});

	test('a value survives the round trip in either scale', () => {
		for (const rung of EXERTION_RUNGS) {
			expect(storedExertion(shownExertion(rung, 'rir'), 'rir')).toBe(rung);
			expect(storedExertion(shownExertion(rung, 'rpe'), 'rpe')).toBe(rung);
		}
	});

	test('the bounds are the same two ends, named from opposite sides', () => {
		expect(shownMin('rpe')).toBe(1);
		expect(shownMax('rpe')).toBe(10);
		expect(shownMin('rir')).toBe(0);
		expect(shownMax('rir')).toBe(9);
	});

	test('the stepper cannot leave the scale in either direction', () => {
		for (const scale of ['rpe', 'rir'] as const) {
			expect(storedExertion(shownMin(scale), scale)).toBe(
				scale === 'rpe' ? EXERTION_MIN : EXERTION_MAX
			);
			expect(storedExertion(shownMax(scale), scale)).toBe(
				scale === 'rpe' ? EXERTION_MAX : EXERTION_MIN
			);
		}
	});
});

describe('labels', () => {
	test('named in both scales, because a bare 8 beside 82.5 × 7 is a third number', () => {
		expect(exertionLabel(8, 'rpe')).toBe('RPE 8');
		expect(exertionLabel(8, 'rir')).toBe('RIR 2');
		expect(scaleName('rir')).toBe('RIR');
	});

	test('an unrated set has no label and no suffix', () => {
		expect(exertionLabel(null, 'rpe')).toBeNull();
		expect(exertionSuffix(null, 'rpe')).toBe('');
	});

	test('a set from before ratings existed is unrated, not a broken label', () => {
		const legacy: { rpe?: number } = {};

		expect(exertionLabel(legacy.rpe, 'rpe')).toBeNull();
		expect(exertionLabel(legacy.rpe, 'rir')).toBeNull();
		expect(exertionSuffix(legacy.rpe, 'rir')).toBe('');
	});

	test('the suffix carries its own separator', () => {
		expect(exertionSuffix(9.5, 'rpe')).toBe(' · RPE 9.5');
		expect(exertionSuffix(9.5, 'rir')).toBe(' · RIR 0.5');
	});
});
