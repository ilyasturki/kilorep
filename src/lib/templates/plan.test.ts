import { describe, expect, test } from 'vitest';

import { entrySummary, planShape, planSummary, repsLabel } from '$lib/templates/plan';
import type { TemplateExercise } from '$lib/domain/template';

/**
 * The four states the editor's card has to draw, and the one rule that is easy
 * to get wrong: a plan holding both numbers and open sets must not be spelled
 * as a range, because a range silently drops the open ones from a label
 * claiming to cover every set.
 */

function planned(targets: (number | null)[]): TemplateExercise {
	return {
		id: 'node',
		exerciseId: 'bench-press',
		sets: targets.map((plannedReps, i) => ({ id: `set-${i + 1}`, plannedReps }))
	};
}

describe('what an exercise prescribes', () => {
	test('nothing on any set is open, and the shared arm has somewhere to start', () => {
		const shape = planShape(planned([null, null, null]));

		expect(shape).toEqual({ sets: 3, kind: 'open', target: 'Open', reps: null });
		expect(repsLabel(shape)).toBe('Open');
	});

	test('one number on every set is the shared target', () => {
		const shape = planShape(planned([8, 8, 8]));

		expect(shape).toEqual({ sets: 3, kind: 'fixed', target: '8', reps: 8 });
		expect(repsLabel(shape)).toBe('8 reps');
	});

	test('numbers that disagree are spelled as their ends', () => {
		const shape = planShape(planned([12, 10, 8]));

		expect(shape).toEqual({ sets: 3, kind: 'range', target: '8–12', reps: null });
		expect(repsLabel(shape)).toBe('8–12 reps');
	});

	test('numbers beside an open set are mixed, never a range', () => {
		const shape = planShape(planned([12, null, 8]));

		expect(shape.kind).toBe('mixed');
		expect(shape.target).toBe('Mixed');
		// The one that matters: `8–12` here would be a label describing two sets
		// out of three while claiming to describe the exercise.
		expect(repsLabel(shape)).toBe('Mixed');
	});

	test('only a settled target hands the shared stepper a number to step from', () => {
		expect(planShape(planned([8, 8])).reps).toBe(8);
		expect(planShape(planned([8, 10])).reps).toBeNull();
		expect(planShape(planned([8, null])).reps).toBeNull();
		expect(planShape(planned([null])).reps).toBeNull();
	});

	test('the sidebar summary is the shape in one glance', () => {
		expect(planSummary(planned([8, 8, 8]))).toBe('3 × 8');
		expect(planSummary(planned([12, 10, 8]))).toBe('3 × 8–12');
		expect(planSummary(planned([null]))).toBe('1 × Open');
	});

	// Both legs spelled out rather than a round count: nothing evens a superset
	// up when it is made, so a row claiming "3 rounds" over a 3-and-2 would be
	// describing a plan nobody wrote.
	test('a superset row spells every leg it holds', () => {
		expect(entrySummary([planned([8, 8, 8]), planned([15, 15])])).toBe('3 × 8 + 2 × 15');
		expect(entrySummary([planned([8, 8, 8])])).toBe('3 × 8');
	});
});
