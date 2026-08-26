import { describe, expect, test } from 'vitest';

import { catalogById } from '$lib/catalog';
import { ordinal, setLabel } from '$lib/exercises/label';

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
