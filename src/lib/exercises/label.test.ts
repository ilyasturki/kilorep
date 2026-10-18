import { describe, expect, test } from 'vitest';

import { catalogById } from '$lib/catalog';
import { addedLabel, bestLabel, ordinal, setFigures, setLabel } from '$lib/exercises/label';

describe('setLabel', () => {
	test('a loaded lift prints what was on the bar', () => {
		expect(setLabel(catalogById['bench-press'], { weight: 80, reps: 5, rpe: null })).toBe('80 × 5');
	});

	test('a bodyweight movement with nothing on the belt prints reps alone', () => {
		expect(setLabel(catalogById['push-up'], { weight: 0, reps: 20, rpe: null })).toBe('20 reps');
	});

	test('a weighted bodyweight movement prints what was added', () => {
		expect(setLabel(catalogById['pull-up'], { weight: 10, reps: 6, rpe: null })).toBe('+10 × 6');
	});
});

describe('setFigures', () => {
	test('a loaded lift splits into its load and its reps', () => {
		expect(setFigures(catalogById['bench-press'], 82.5, 8)).toEqual({ load: '82.5', reps: '8' });
	});

	test('a weighted bodyweight movement shows what was added', () => {
		expect(setFigures(catalogById['pull-up'], 10, 6)).toEqual({ load: '+10', reps: '6' });
	});

	test('a bodyweight movement with nothing on the belt has no load', () => {
		expect(setFigures(catalogById['push-up'], 0, 20)).toEqual({ load: null, reps: '20' });
	});

	test('a loaded lift at zero still shows its zero', () => {
		expect(setFigures(catalogById['bench-press'], 0, 5)).toEqual({ load: '0', reps: '5' });
	});

	test('a blank reads as a dash, on any movement', () => {
		expect(setFigures(catalogById['bench-press'], null, null)).toEqual({ load: '–', reps: '–' });
		expect(setFigures(catalogById['pull-up'], null, 6)).toEqual({ load: '–', reps: '6' });
		expect(setFigures(catalogById['push-up'], 0, null)).toEqual({ load: null, reps: '–' });
	});
});

describe('bestLabel', () => {
	test('the raw best is Heaviest wherever something was added', () => {
		expect(bestLabel(catalogById['bench-press'], { weight: 100, reps: 3, rpe: null })).toBe(
			'Heaviest 100 × 3'
		);
		expect(bestLabel(catalogById['pull-up'], { weight: 5, reps: 6, rpe: null })).toBe(
			'Heaviest +5 × 6'
		);
	});

	test('and Most reps where the belt was always empty, saying reps once', () => {
		expect(bestLabel(catalogById['pull-up'], { weight: 0, reps: 12, rpe: null })).toBe(
			'Most reps 12'
		);
	});
});

describe('addedLabel', () => {
	test('a weight column never reads 0 on a body-weight movement', () => {
		expect(addedLabel(catalogById['pull-up'], 0)).toBe('body');
		expect(addedLabel(catalogById['pull-up'], 5)).toBe('+5');
		expect(addedLabel(catalogById['bench-press'], 0)).toBe('0');
		expect(addedLabel(catalogById['bench-press'], 80)).toBe('80');
	});
});

describe('ordinal', () => {
	test('the four endings', () => {
		expect(ordinal(1)).toBe('1st');
		expect(ordinal(2)).toBe('2nd');
		expect(ordinal(3)).toBe('3rd');
		expect(ordinal(4)).toBe('4th');
	});

	test('the teens are all -th, the twenties are not', () => {
		expect(ordinal(11)).toBe('11th');
		expect(ordinal(12)).toBe('12th');
		expect(ordinal(13)).toBe('13th');
		expect(ordinal(21)).toBe('21st');
		expect(ordinal(22)).toBe('22nd');
		expect(ordinal(23)).toBe('23rd');
	});
});
