import { describe, expect, test } from 'vitest';

import { weightStep } from '$lib/domain/exercise';

describe('weightStep', () => {
	test('racked implements step in the rack’s own jumps', () => {
		expect(weightStep('Dumbbell')).toBe(2);
		expect(weightStep('Kettlebell')).toBe(2);
	});

	test('everything plate-loaded or stacked keeps the smallest plate pair', () => {
		expect(weightStep('Barbell')).toBe(2.5);
		expect(weightStep('Cable')).toBe(2.5);
		expect(weightStep('Machine')).toBe(2.5);
		expect(weightStep('Bodyweight')).toBe(2.5);
		expect(weightStep('Band')).toBe(2.5);
	});
});
