import { describe, expect, test } from 'vitest';

import { changeLabel, changesLine, swapLabel } from '$lib/templates/offer';

describe('the offer in words', () => {
	test('each change names its exercise the way the record badges do', () => {
		expect(changeLabel({ kind: 'sets', exerciseId: 'bench-press', from: 3, to: 4 })).toBe(
			'Bench Press +1 set'
		);
		expect(changeLabel({ kind: 'sets', exerciseId: 'bench-press', from: 4, to: 2 })).toBe(
			'Bench Press −2 sets'
		);
		expect(changeLabel({ kind: 'grip', exerciseId: 'triceps-pushdown', grip: 'bar' })).toBe(
			'Triceps Pushdown: Straight Bar'
		);
		expect(changeLabel({ kind: 'added', exerciseId: 'dip' })).toBe('Dip added');
		expect(changeLabel({ kind: 'removed', exerciseId: 'cable-fly' })).toBe('Cable Fly not done');
	});

	test('the changes read as one line', () => {
		expect(
			changesLine([
				{ kind: 'sets', exerciseId: 'bench-press', from: 3, to: 4 },
				{ kind: 'order' },
				{ kind: 'supersets' }
			])
		).toBe('Bench Press +1 set · new order · supersets changed');
	});

	test('a swap is offered as a replacement', () => {
		expect(swapLabel({ legId: 'x', from: 'squat', to: 'hack-squat' })).toBe(
			'Replace Squat with Hack Squat'
		);
	});
});
