import { describe, expect, test } from 'vitest';

import { catalog } from '$lib/catalog';
import { shownCaption, shownExercises } from '$lib/exercises/picker';

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

describe('shownCaption', () => {
	test('names the chips that made the list', () => {
		expect(shownCaption({ query: '', muscle: 'Chest', equipment: 'Dumbbell' })).toBe(
			'Chest · Dumbbell'
		);
		expect(shownCaption({ query: '', muscle: 'Back', equipment: null })).toBe('Back');
		expect(shownCaption({ query: '', muscle: null, equipment: null })).toBe('All exercises');
	});
});
