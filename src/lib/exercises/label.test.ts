import { describe, expect, test } from 'vitest';

import { ordinal, variantLabel } from '$lib/exercises/label';

describe('variantLabel', () => {
	test('strips the parent name, keeping the qualifier', () => {
		expect(variantLabel('Close-Grip Bench Press', 'Bench Press')).toBe('Close-Grip');
		expect(variantLabel('Wide-Grip Lat Pulldown', 'Lat Pulldown')).toBe('Wide-Grip');
		expect(variantLabel('Front Squat', 'Squat')).toBe('Front');
	});

	test('compares DB and Dumbbell as the same word', () => {
		expect(variantLabel('Incline DB Press', 'Dumbbell Bench Press')).toBe('Incline');
	});

	test('a variant sharing no words keeps its full name', () => {
		expect(variantLabel('Chin-Up', 'Pull-Up')).toBe('Chin-Up');
	});

	test('a variant whose every word the parent carries keeps its full name', () => {
		expect(variantLabel('Bench Press', 'Bench Press')).toBe('Bench Press');
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
