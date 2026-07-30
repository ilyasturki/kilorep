import { describe, expect, test } from 'vitest';

import { bestSet, rawPr } from '$lib/domain/stats';

describe('bestSet', () => {
	test('no history is null, not a zero', () => {
		expect(bestSet([])).toBeNull();
	});

	test('heaviest weight wins regardless of reps', () => {
		expect(
			bestSet([
				{ weight: 100, reps: 1 },
				{ weight: 80, reps: 12 }
			])
		).toEqual({ weight: 100, reps: 1 });
	});

	test('equal weight tie-breaks on reps', () => {
		expect(
			bestSet([
				{ weight: 100, reps: 3 },
				{ weight: 100, reps: 5 },
				{ weight: 100, reps: 4 }
			])
		).toEqual({ weight: 100, reps: 5 });
	});

	test('a full tie keeps the first achievement', () => {
		const first = { weight: 100, reps: 5 };

		expect(bestSet([first, { weight: 100, reps: 5 }])).toBe(first);
	});
});

describe('rawPr', () => {
	test('no sessions is null, not a zero', () => {
		expect(rawPr([])).toBeNull();
	});

	test('dates the PR to the session that set it, not the latest one', () => {
		const pr = rawPr([
			{ date: 1, sets: [{ weight: 100, reps: 3 }] },
			{ date: 2, sets: [{ weight: 90, reps: 8 }] }
		]);

		expect(pr).toEqual({ set: { weight: 100, reps: 3 }, date: 1 });
	});

	test('matching the PR later does not move its date', () => {
		const pr = rawPr([
			{ date: 1, sets: [{ weight: 100, reps: 5 }] },
			{ date: 2, sets: [{ weight: 100, reps: 5 }] }
		]);

		expect(pr!.date).toBe(1);
	});
});
