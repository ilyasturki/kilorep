import { describe, expect, test } from 'vitest';

import { applyMains, familyOf, sections, similarTo } from '$lib/exercises/browse';
import type { Equipment, Exercise, Muscle } from '$lib/domain/exercise';

/**
 * A hand-made pool rather than the real catalog, for the reason `search.test`
 * gives: these tests pin the shelving and the substitute rules, and growing the
 * catalog must never break them.
 *
 * The shape mirrors the chest corner of the real one closely enough to be
 * honest — a barbell family with a variant that shelves under another muscle, a
 * dumbbell family, a lone barbell entry and two lone machines — because every
 * tier boundary `similarTo` draws is a distinction that corner contains.
 */
function ex(
	id: string,
	name: string,
	equipment: Equipment,
	primary: Muscle,
	variantOf?: string
): Exercise {
	const exercise: Exercise = {
		id,
		name,
		aliases: [],
		equipment,
		loadMode: 'total',
		muscles: { primary, secondary: ['Triceps'] }
	};

	// Assigned rather than spread in: `variantOf` is optional, and an explicit
	// `variantOf: undefined` is a different shape from an absent key — the
	// promotion rule reads the key, not its value.
	if (variantOf !== undefined) {
		exercise.variantOf = variantOf;
	}

	return exercise;
}

const bench = ex('bench-press', 'Bench Press', 'Barbell', 'Chest');
const closeGrip = ex('close-grip-bench', 'Close-Grip Bench', 'Barbell', 'Triceps', 'bench-press');
const incline = ex('incline-bench', 'Incline Bench', 'Barbell', 'Chest', 'bench-press');
// Barbell and Chest with no family, so the same-rack tier is a real tier here
// and not something only kinship ever reaches.
const floor = ex('floor-press', 'Floor Press', 'Barbell', 'Chest');
const dbBench = ex('db-bench', 'Dumbbell Bench', 'Dumbbell', 'Chest');
const dbIncline = ex('db-incline', 'Incline DB Press', 'Dumbbell', 'Chest', 'db-bench');
const overhead = ex('overhead-press', 'Overhead Press', 'Barbell', 'Shoulders');
const fly = ex('cable-fly', 'Cable Fly', 'Cable', 'Chest');
const pecDeck = ex('pec-deck', 'Pec Deck', 'Machine', 'Chest');
const squat = ex('squat', 'Squat', 'Barbell', 'Quads');

const pool = [bench, closeGrip, incline, floor, dbBench, dbIncline, overhead, fly, pecDeck, squat];

const idsOf = (result: Exercise[]): string[] => result.map((e) => e.id);

/** A pool member by id, or a loud failure — a reseat must never lose one. */
function entryOf(reseated: Exercise[], id: string): Exercise {
	const found = reseated.find((entry) => entry.id === id);

	if (found === undefined) {
		throw new Error(`the reseated pool lost ${id}`);
	}

	return found;
}

describe('sections', () => {
	test('a family shelves under its parent, empty muscles are absent', () => {
		const shelved = sections(pool);

		expect(shelved.map((s) => s.muscle)).toEqual(['Chest', 'Shoulders', 'Quads']);

		const chest = shelved[0];
		expect(chest.families.map((f) => f.parent.id)).toEqual([
			'bench-press',
			'cable-fly',
			'db-bench',
			'floor-press',
			'pec-deck'
		]);
		// Close-Grip is a Triceps exercise and still lives with Bench Press: the
		// row the user scans for is the family's.
		expect(idsOf(chest.families[0].variants)).toEqual(['close-grip-bench', 'incline-bench']);
	});

	test('a variant naming a parent the pool lacks is promoted, never dropped', () => {
		const orphan = ex('orphan', 'Orphan', 'Barbell', 'Chest', 'typo');

		expect(sections([orphan])[0].families.map((f) => f.parent.id)).toEqual(['orphan']);
	});
});

describe('similarTo', () => {
	test('the family comes first, whatever muscle it shelves under', () => {
		// Close-Grip is a Triceps exercise, so only kinship can put it here.
		expect(idsOf(similarTo(pool, bench)).slice(0, 2)).toEqual([
			'close-grip-bench',
			'incline-bench'
		]);
	});

	test('the parent and its other children are family too', () => {
		expect(idsOf(similarTo(pool, incline)).slice(0, 2)).toEqual([
			'bench-press',
			'close-grip-bench'
		]);
	});

	test('same rack outranks another rack, and both beat another muscle', () => {
		// Floor Press sits above Cable Fly despite the alphabet, which is the tier
		// doing the work. Overhead Press and Squat share no primary and are absent
		// however close their name sorts.
		expect(idsOf(similarTo(pool, bench))).toEqual([
			'close-grip-bench',
			'incline-bench',
			'floor-press',
			'cable-fly',
			'db-bench',
			'db-incline'
		]);
	});

	test('no family falls straight through to the muscle', () => {
		expect(idsOf(similarTo(pool, pecDeck))).toEqual([
			'bench-press',
			'cable-fly',
			'db-bench',
			'floor-press',
			'incline-bench',
			'db-incline'
		]);
	});

	test('never itself, and never past the cap', () => {
		expect(idsOf(similarTo(pool, bench))).not.toContain('bench-press');
		expect(similarTo(pool, bench, 2)).toHaveLength(2);
	});

	test('nothing to suggest is an empty list, not a filler one', () => {
		// Squat is the only Quads exercise in the pool and has no family.
		expect(similarTo(pool, squat)).toEqual([]);
	});
});

describe('familyOf', () => {
	test('resolves both directions', () => {
		expect(familyOf(pool, incline).parent).toBe(bench);
		expect(idsOf(familyOf(pool, bench).variants)).toEqual(['close-grip-bench', 'incline-bench']);
	});

	test('a parent the pool lacks resolves to none', () => {
		expect(familyOf(pool, ex('orphan', 'Orphan', 'Barbell', 'Chest', 'typo')).parent).toBeNull();
	});
});

describe('applyMains', () => {
	test('no honourable choice is the identity, by reference', () => {
		expect(applyMains(pool, {})).toBe(pool);

		// The parent itself, a member of another family, a slug the pool lacks:
		// stale taste means the default, never a broken screen.
		expect(
			applyMains(pool, {
				'bench-press': 'bench-press',
				'db-bench': 'incline-bench',
				squat: 'smith-squat'
			})
		).toBe(pool);
	});

	test('seats the chosen main and points the family at it, parent included', () => {
		const reseated = applyMains(pool, { 'bench-press': 'incline-bench' });

		expect(entryOf(reseated, 'incline-bench').variantOf).toBeUndefined();
		expect(entryOf(reseated, 'bench-press').variantOf).toBe('incline-bench');
		expect(entryOf(reseated, 'close-grip-bench').variantOf).toBe('incline-bench');

		// Untouched families pass through by reference, not as copies.
		expect(entryOf(reseated, 'db-incline')).toBe(dbIncline);
	});

	test('the fold then shelves the family under the chosen main', () => {
		const shelved = sections(applyMains(pool, { 'bench-press': 'close-grip-bench' }));

		// Close-Grip leads now, so the family stands in *its* section — Triceps —
		// with the old head folded into the chips like any other member.
		const triceps = shelved.find((section) => section.muscle === 'Triceps');
		const family =
			triceps === undefined
				? undefined
				: triceps.families.find((entry) => entry.parent.id === 'close-grip-bench');

		if (family === undefined) {
			throw new Error('the reseated family is not shelved under Triceps');
		}

		expect(idsOf(family.variants)).toEqual(['bench-press', 'incline-bench']);

		const chest = shelved.find((section) => section.muscle === 'Chest');

		if (chest === undefined) {
			throw new Error('the Chest section is gone');
		}

		expect(chest.families.some((entry) => entry.parent.id === 'bench-press')).toBe(false);
	});

	test('familyOf answers both directions from the new head', () => {
		const reseated = applyMains(pool, { 'bench-press': 'incline-bench' });
		const head = entryOf(reseated, 'incline-bench');
		const demoted = entryOf(reseated, 'bench-press');

		expect(familyOf(reseated, head).parent).toBeNull();
		expect(idsOf(familyOf(reseated, head).variants)).toEqual(['bench-press', 'close-grip-bench']);
		expect(familyOf(reseated, demoted).parent).toBe(head);
	});
});
