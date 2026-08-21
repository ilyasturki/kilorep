import { describe, expect, test } from 'vitest';

import { weightStep } from '$lib/domain/exercise';
import type { Equipment } from '$lib/domain/exercise';

const up = (equipment: Equipment, from: number): number => weightStep(equipment, from, 1);
const down = (equipment: Equipment, from: number): number => weightStep(equipment, from, -1);

describe('weightStep', () => {
	test('everything plate-loaded or stacked keeps the smallest plate pair', () => {
		expect(up('Barbell', 60)).toBe(2.5);
		expect(up('Cable', 5)).toBe(2.5);
		expect(down('Machine', 5)).toBe(2.5);
		expect(up('Bodyweight', 0)).toBe(2.5);
		expect(up('Band', 0)).toBe(2.5);
	});

	test('kettlebells step in pairs at every weight — no rack sells them in single kilos', () => {
		expect(up('Kettlebell', 4)).toBe(2);
		expect(down('Kettlebell', 8)).toBe(2);
		expect(up('Kettlebell', 24)).toBe(2);
	});

	test('dumbbells step in pairs from ten up', () => {
		expect(up('Dumbbell', 10)).toBe(2);
		expect(up('Dumbbell', 30)).toBe(2);
		expect(down('Dumbbell', 30)).toBe(2);
	});

	test('dumbbells step one at a time under ten, where a pair is a fifth of the load', () => {
		expect(up('Dumbbell', 6)).toBe(1);
		expect(down('Dumbbell', 6)).toBe(1);
		expect(up('Dumbbell', 0)).toBe(1);
	});

	test('the ten boundary belongs to the finer half both ways', () => {
		// Down off 10 lands on 9; up off 9 lands on 10 rather than skipping it.
		expect(down('Dumbbell', 10)).toBe(1);
		expect(up('Dumbbell', 9)).toBe(1);
	});
});
