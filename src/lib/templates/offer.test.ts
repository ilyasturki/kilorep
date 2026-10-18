import { describe, expect, test } from 'vitest';

import type { Workout } from '$lib/domain/workout';
import { changeLabel, changesLine, offerStands, swapLabel } from '$lib/templates/offer';

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

describe('whether the offer stands', () => {
	const workout: Workout = { id: 'w1', templateId: 't1', startedAt: 1000, entries: [] };

	test('on the newest session, unanswered, of a plan untouched since it began', () => {
		expect(offerStands(workout, { newest: 'w1', answered: null, planWrittenAt: 900 })).toBe(true);
		expect(offerStands(workout, { newest: 'w1', answered: 'w0', planWrittenAt: 1000 })).toBe(true);
	});

	test('with no plan behind it, on the newest session', () => {
		expect(offerStands(workout, { newest: 'w1', answered: null, planWrittenAt: null })).toBe(true);
	});

	test('not once it is answered, nor on an older session', () => {
		expect(offerStands(workout, { newest: 'w1', answered: 'w1', planWrittenAt: 900 })).toBe(false);
		expect(offerStands(workout, { newest: 'w2', answered: null, planWrittenAt: 900 })).toBe(false);
		expect(offerStands(workout, { newest: null, answered: null, planWrittenAt: 900 })).toBe(false);
	});

	test('not after the plan was written since the session began, which Update would undo', () => {
		expect(offerStands(workout, { newest: 'w1', answered: null, planWrittenAt: 1001 })).toBe(false);
	});
});
