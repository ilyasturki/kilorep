import { describe, expect, it } from 'vitest';

import { catalog } from '$lib/catalog';
import { normalize } from '$lib/domain/search';

describe('catalog aliases', () => {
	it('are spelled once each, non-empty, compared-form, and never the entry name', () => {
		for (const exercise of catalog) {
			expect(new Set(exercise.aliases).size, exercise.id).toBe(exercise.aliases.length);
			expect(exercise.aliases, exercise.id).not.toContain(normalize(exercise.name));

			for (const alias of exercise.aliases) {
				expect(alias, `${exercise.id}: ${JSON.stringify(alias)}`).toBe(normalize(alias));
				expect(alias.length, exercise.id).toBeGreaterThan(0);
			}
		}
	});
});
