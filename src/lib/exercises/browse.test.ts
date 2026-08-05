import { describe, expect, test } from 'vitest';

import { kin, sections, similarTo } from '$lib/exercises/browse';
import type { Equipment, Exercise, Muscle } from '$lib/domain/exercise';

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

	if (variantOf !== undefined) {
		exercise.variantOf = variantOf;
	}

	return exercise;
}

const bench = ex('bench-press', 'Bench Press', 'Barbell', 'Chest');
const closeGrip = ex('close-grip-bench', 'Close-Grip Bench', 'Barbell', 'Triceps', 'bench-press');
const incline = ex('incline-bench', 'Incline Bench', 'Barbell', 'Chest', 'bench-press');
const floor = ex('floor-press', 'Floor Press', 'Barbell', 'Chest');
const dbBench = ex('db-bench', 'Dumbbell Bench', 'Dumbbell', 'Chest');
const dbIncline = ex('db-incline', 'Incline DB Press', 'Dumbbell', 'Chest', 'db-bench');
const overhead = ex('overhead-press', 'Overhead Press', 'Barbell', 'Shoulders');
const fly = ex('cable-fly', 'Cable Fly', 'Cable', 'Chest');
const pecDeck = ex('pec-deck', 'Pec Deck', 'Machine', 'Chest');
const squat = ex('squat', 'Squat', 'Barbell', 'Quads');

const pool = [bench, closeGrip, incline, floor, dbBench, dbIncline, overhead, fly, pecDeck, squat];

const idsOf = (result: Exercise[]): string[] => result.map((e) => e.id);

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
		expect(idsOf(chest.families[0].variants)).toEqual(['close-grip-bench', 'incline-bench']);
	});

	test('a variant naming a parent the pool lacks is promoted, never dropped', () => {
		const orphan = ex('orphan', 'Orphan', 'Barbell', 'Chest', 'typo');

		expect(sections([orphan])[0].families.map((f) => f.parent.id)).toEqual(['orphan']);
	});
});

describe('similarTo', () => {
	test('the family comes first, whatever muscle it shelves under', () => {
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
		expect(similarTo(pool, squat)).toEqual([]);
	});
});

describe('kin', () => {
	test('a parent lists its children', () => {
		expect(idsOf(kin(pool, bench))).toEqual(['close-grip-bench', 'incline-bench']);
	});

	test('a variant lists the parent and its siblings, never itself', () => {
		expect(idsOf(kin(pool, incline))).toEqual(['bench-press', 'close-grip-bench']);
	});

	test('the same family whichever member is asked', () => {
		const family = (exercise: Exercise): string[] =>
			[...idsOf(kin(pool, exercise)), exercise.id].toSorted();

		expect(family(incline)).toEqual(family(closeGrip));
		expect(family(incline)).toEqual(family(bench));
	});

	test('a lone exercise has none, and neither family bleeds into the other', () => {
		expect(kin(pool, pecDeck)).toEqual([]);
		expect(idsOf(kin(pool, dbIncline))).toEqual(['db-bench']);
	});

	test('a parent the pool lacks leaves the entry its own root', () => {
		expect(kin(pool, ex('orphan', 'Orphan', 'Barbell', 'Chest', 'typo'))).toEqual([]);
	});
});
