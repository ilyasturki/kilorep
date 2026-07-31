import { describe, expect, test } from 'vitest';

import { matchRange, searchExercises } from '$lib/domain/search';
import type { Exercise } from '$lib/domain/exercise';

/**
 * A hand-made pool rather than the real catalog: these tests pin the matching
 * rules, and growing the catalog must never break them.
 */
function ex(id: string, name: string, aliases: string[] = []): Exercise {
	return {
		id,
		name,
		aliases,
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: [] }
	};
}

const pool = [
	ex('bench-press', 'Bench Press', ['bp', 'flat bench']),
	ex('overhead-press', 'Overhead Press', ['ohp', 'military press']),
	ex('leg-press', 'Leg Press'),
	ex('lat-pulldown', 'Lat Pulldown', ['pulldown']),
	ex('close-grip-lat-pulldown', 'Close-Grip Lat Pulldown', ['close grip pulldown']),
	ex('developpe-couche', 'Développé Couché'),
	ex('squat', 'Squat', ['back squat']),
	ex('front-raise', 'Front Raise'),
	ex('dip', 'Dip'),
	ex('hip-thrust', 'Hip Thrust')
];

const ids = (query: string): string[] => searchExercises(pool, query).map((e) => e.id);

describe('the substring pass', () => {
	test('an empty query is the browse list, untouched', () => {
		expect(searchExercises(pool, '')).toBe(pool);
		expect(searchExercises(pool, '   ')).toBe(pool);
	});

	test('a name prefix outranks a name substring', () => {
		// "leg" starts Leg Press and merely appears inside nothing else here;
		// "press" starts no name but is a word of three.
		expect(ids('leg')).toEqual(['leg-press']);
		expect(ids('press')).toEqual(['bench-press', 'leg-press', 'overhead-press']);
	});

	test('an alias is as good as typing the name', () => {
		expect(ids('ohp')).toEqual(['overhead-press']);
		expect(ids('military')).toEqual(['overhead-press']);
	});

	test('a name-word prefix outranks an alias hit', () => {
		// "pulldown" is a word of both names and an alias of the parent — the
		// visible-name matches come first, alphabetically among themselves.
		expect(ids('pulldown')).toEqual(['close-grip-lat-pulldown', 'lat-pulldown']);
	});

	test('case and diacritics never matter', () => {
		expect(ids('developpe')).toEqual(['developpe-couche']);
		expect(ids('DÉVELOPPÉ')).toEqual(['developpe-couche']);
	});

	test('a hyphenated name answers to a spaced query', () => {
		expect(ids('close grip')).toEqual(['close-grip-lat-pulldown']);
	});
});

describe('the fuzzy fallback', () => {
	test('a typo is caught when substring finds nothing', () => {
		expect(ids('bnech')).toEqual(['bench-press']);
		expect(ids('sqaut')).toEqual(['squat']);
	});

	test('fuzzy never runs when substring found anything', () => {
		// "hip" is one edit from "dip", well inside the fallback's tolerance —
		// but "dip" hits Dip exactly, so the fallback never gets to speak.
		expect(ids('dip')).toEqual(['dip']);
	});

	test('far-off queries return nothing rather than guesses', () => {
		expect(ids('cardio')).toEqual([]);
	});
});

/** The slice the range names, which is what the row will underline. */
const marked = (name: string, query: string): string | null => {
	const range = matchRange(name, query);

	return range === null ? null : name.slice(range.start, range.end);
};

describe('the match range', () => {
	test('a plain substring maps straight through', () => {
		expect(marked('Bench Press', 'bench')).toBe('Bench');
		expect(marked('Overhead Press', 'press')).toBe('Press');
	});

	test('a spaced query marks the hyphenated characters it matched', () => {
		expect(marked('Close-Grip Lat Pulldown', 'close grip')).toBe('Close-Grip');
	});

	test('a bare-keyboard query marks the accented name', () => {
		expect(marked('Développé Couché', 'developpe')).toBe('Développé');
	});

	test('an alias hit and a fuzzy save mark nothing', () => {
		// The row lists them, but the matched text is not on screen.
		expect(marked('Overhead Press', 'ohp')).toBeNull();
		expect(marked('Bench Press', 'bnech')).toBeNull();
	});

	test('an empty query marks nothing', () => {
		expect(marked('Bench Press', '')).toBeNull();
		expect(marked('Bench Press', '   ')).toBeNull();
	});
});
