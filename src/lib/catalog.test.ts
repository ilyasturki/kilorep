import { describe, expect, it } from 'vitest';

import { catalog, catalogById, FOLDED } from '$lib/catalog';
import { settleGrip } from '$lib/domain/grip';
import { bodyweightShareOf } from '$lib/domain/load';
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

const shareOf = (id: string): number => bodyweightShareOf(catalogById[id]);

describe('bodyweight shares', () => {
	// A new Bodyweight entry that stayed silent would post a pull-up as the belt alone, which
	// is the bug this feature exists to end.
	it('are stated on every Bodyweight entry and on nothing else', () => {
		for (const exercise of catalog) {
			const stated = Object.hasOwn(exercise, 'bodyweightShare');

			expect(stated, exercise.id).toBe(exercise.equipment === 'Bodyweight');
		}
	});

	it('are a share of one body, never a weight', () => {
		for (const exercise of catalog) {
			const share = bodyweightShareOf(exercise);

			expect(share, exercise.id).toBeGreaterThanOrEqual(0);
			expect(share, exercise.id).toBeLessThanOrEqual(1);
		}
	});

	it('put the whole body on a pull-up, part of one on a push-up and none on a plank', () => {
		expect(shareOf('pull-up')).toBe(1);
		expect(shareOf('plank')).toBe(0);
		expect(shareOf('push-up')).toBeGreaterThan(0);
		expect(shareOf('push-up')).toBeLessThan(1);
	});
});

describe('grip axes', () => {
	it('name a default that is one of their own values, spelled once each', () => {
		for (const exercise of catalog) {
			const axis = exercise.grips;

			if (axis === undefined) {
				continue;
			}

			const ids = axis.values.map((value) => value.id);

			expect(ids.length, exercise.id).toBeGreaterThan(1);
			expect(new Set(ids).size, exercise.id).toBe(ids.length);
			expect(ids, exercise.id).toContain(axis.default);

			for (const value of axis.values) {
				expect(value.label.length, `${exercise.id}: ${value.id}`).toBeGreaterThan(0);
			}
		}
	});
});

describe('folded entries', () => {
	// A retired slug that pointed nowhere would drop the sessions logged under it, silently.
	it('point at a live entry, and at a grip that entry actually offers', () => {
		for (const [slug, folded] of Object.entries(FOLDED)) {
			expect(catalogById[slug], slug).toBeUndefined();

			const parent = catalogById[folded.id];

			expect(parent, slug).toBeDefined();
			expect(settleGrip(parent, folded.grip), slug).toBe(folded.grip);
		}
	});

	it('leave their searchable spellings behind on the parent', () => {
		for (const [slug, folded] of Object.entries(FOLDED)) {
			const parent = catalogById[folded.id];
			const word = slug.split('-')[0];

			expect(
				parent.aliases.some((alias) => alias.includes(word)),
				slug
			).toBe(true);
		}
	});
});
