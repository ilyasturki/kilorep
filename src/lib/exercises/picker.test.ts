import { describe, expect, test } from 'vitest';

import { catalog, catalogById, FOLDED } from '$lib/catalog';
import type { Exercise } from '$lib/domain/exercise';
import { gripsOf, settleGrip } from '$lib/domain/grip';
import { normalize } from '$lib/domain/search';
import { GRIP_ALIASES } from '$lib/exercises/aliases';
import type { Family } from '$lib/exercises/browse';
import { gripNamed, pickerGroups, pickOf, shownExercises } from '$lib/exercises/picker';
import type { PickerGroup } from '$lib/exercises/picker';

function familyOf(groups: PickerGroup[], id: string): Family | undefined {
	return groups.flatMap((group) => group.families).find((family) => family.parent.id === id);
}

function familyAt(groups: PickerGroup[], id: string): Family {
	const family = familyOf(groups, id);

	if (family === undefined) {
		throw new Error(`no family led by ${id}`);
	}

	return family;
}

describe('shownExercises', () => {
	test('no filters shows the whole catalog', () => {
		expect(shownExercises(catalog, { query: '', muscle: null, equipment: null })).toHaveLength(
			catalog.length
		);
	});

	test('a query narrows inside the chips', () => {
		const shown = shownExercises(catalog, { query: 'fly', muscle: 'Chest', equipment: 'Dumbbell' });

		expect(shown.map((e) => e.id)).toContain('dumbbell-fly');
		expect(shown.every((e) => e.muscles.primary === 'Chest' && e.equipment === 'Dumbbell')).toBe(
			true
		);
	});
});

describe('pickerGroups', () => {
	const none = { query: '', muscle: null, equipment: null };

	test('browsing folds a family under its parent, variants listed nowhere else', () => {
		const groups = pickerGroups(catalog, none);
		const bench = familyAt(groups, 'bench-press');

		expect(bench.variants.map((v) => v.id)).toContain('incline-bench-press');
		expect(familyOf(groups, 'incline-bench-press')).toBeUndefined();
		expect(groups.map((group) => group.caption)[0]).toBe('Chest');
	});

	test('a filter folds what is left, by muscle', () => {
		const groups = pickerGroups(catalog, { query: '', muscle: 'Back', equipment: null });

		expect(groups.map((group) => group.caption)).toEqual(['Back']);
		expect(familyOf(groups, 'pull-up')).toBeDefined();
	});

	test('a search lists its matches flat, variants as rows of their own', () => {
		const groups = pickerGroups(catalog, { query: 'incline', muscle: null, equipment: null });

		expect(groups).toHaveLength(1);
		expect(groups[0].caption).toBe('All matches');
		expect(familyAt(groups, 'incline-bench-press').variants).toEqual([]);
	});

	test('what a shelf above already shows is not repeated below', () => {
		const shelf = [catalogById['incline-bench-press'], catalogById['dumbbell-bench-press']];
		const groups = pickerGroups(catalog, none, shelf);
		const ids = groups.flatMap((group) =>
			group.families.flatMap((family) => [family.parent, ...family.variants].map((e) => e.id))
		);

		expect(ids).not.toContain('incline-bench-press');
		expect(ids).not.toContain('dumbbell-bench-press');
		expect(ids).toContain('bench-press');
	});
});

describe('gripNamed', () => {
	const pullUp = catalogById['pull-up'];
	const pulldown = catalogById['lat-pulldown'];

	test('an alias that names a grip picks it', () => {
		expect(gripNamed(pullUp, 'chin up')).toBe('underhand');
		expect(gripNamed(pullUp, 'Chin-up')).toBe('underhand');
		expect(gripNamed(pulldown, 'close grip pulldown')).toBe('neutral');
		expect(gripNamed(catalogById['seated-cable-row'], 'straight bar row')).toBe('wide');
		expect(gripNamed(catalogById['seated-cable-row'], 'v bar')).toBe('v-bar');
	});

	test('half an alias is enough, in any order', () => {
		expect(gripNamed(pullUp, 'chin')).toBe('underhand');
		expect(gripNamed(pulldown, 'pulldown narrow')).toBe('neutral');
	});

	test('the exercise’s own name names no grip', () => {
		expect(gripNamed(pullUp, 'pull up')).toBeUndefined();
		expect(gripNamed(pullUp, 'pull')).toBeUndefined();
		expect(gripNamed(pulldown, 'lat')).toBeUndefined();
	});

	test('aliases that disagree name none', () => {
		expect(gripNamed(pullUp, 'grip')).toBeUndefined();
		expect(gripNamed(pulldown, 'grip pulldown')).toBeUndefined();
	});

	test('no query, no axis, or an alias naming nothing names none', () => {
		expect(gripNamed(pullUp, '')).toBeUndefined();
		expect(gripNamed(catalogById['barbell-row'], 'bent over row')).toBeUndefined();
		expect(gripNamed(pullUp, 'wide grip')).toBeUndefined();
	});
});

describe('pickOf', () => {
	test('the pick is the exercise, and the grip only when the query named one', () => {
		expect(pickOf(catalogById['pull-up'], 'chin')).toEqual({
			exerciseId: 'pull-up',
			grip: 'underhand'
		});
		expect(pickOf(catalogById['pull-up'], 'pull')).toEqual({ exerciseId: 'pull-up' });
		expect('grip' in pickOf(catalogById['bench-press'], '')).toBe(false);
	});

	test('nothing the picker offers is a retired slug', () => {
		const offered = new Set(catalog.map((exercise) => exercise.id));

		expect(Object.keys(FOLDED).filter((slug) => offered.has(slug))).toEqual([]);
	});
});

describe('GRIP_ALIASES', () => {
	const rows = Object.entries(GRIP_ALIASES).flatMap(([id, aliases]) =>
		Object.entries(aliases).map(([alias, grip]) => ({ id, alias, grip }))
	);

	test('every phrase is a searchable alias of its exercise', () => {
		const missing = rows.filter(({ id, alias }) => {
			const meta = catalogById[id] as Exercise | undefined;
			const aliases = meta === undefined ? [] : meta.aliases.map((known) => normalize(known));

			return !aliases.includes(normalize(alias));
		});

		expect(missing).toEqual([]);
	});

	test('every grip it names is one the axis still settles on', () => {
		const lost = rows.filter(({ id, grip }) => {
			const meta = catalogById[id];
			const settled = settleGrip(meta, grip);

			return settled === undefined || !gripsOf(meta).some((value) => value.id === settled);
		});

		expect(lost).toEqual([]);
	});
});
