import { describe, expect, it } from 'vitest';

import { catalog, catalogById, FOLDED } from '$lib/catalog';
import type { Exercise } from '$lib/domain/exercise';
import { gripsOf, settleGrip } from '$lib/domain/grip';
import { bodyweightShareOf } from '$lib/domain/load';
import { normalize } from '$lib/domain/search';
import drawn from '$lib/exercises/illustrations.json';

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

describe('the catalog as a whole', () => {
	// A spelling two entries both answer to sends the lifter to whichever sorts first.
	it('gives every alias and every name to one entry only', () => {
		const owner = new Map<string, string>();

		for (const exercise of catalog) {
			for (const spelling of [normalize(exercise.name), ...exercise.aliases]) {
				expect(owner.get(spelling) ?? exercise.id, spelling).toBe(exercise.id);
				owner.set(spelling, exercise.id);
			}
		}
	});

	// The lists shelve a variant under a parent that is itself shelved: one pointing at another
	// variant drops out of the Exercises list.
	it('roots every variant on an entry that is no one else’s variant', () => {
		for (const exercise of catalog) {
			if (exercise.variantOf === undefined) {
				continue;
			}

			const parent = catalogById[exercise.variantOf];

			expect(parent, exercise.id).toBeDefined();
			expect(parent.variantOf, exercise.id).toBeUndefined();
		}
	});

	it('states a movement pattern on every entry', () => {
		for (const exercise of catalog) {
			expect(exercise.pattern, exercise.id).toBeDefined();
		}
	});
});

// Every grip value id that ever shipped, read off the catalog's history. A set on disk carries
// one of these forever, so each must keep resolving to itself or to what it was retired into.
const SHIPPED_GRIPS: Record<string, string[]> = {
	'bench-press': ['standard', 'close'],
	'cable-curl': ['bar', 'ez', 'rope'],
	dip: ['upright', 'forward'],
	'lat-pulldown': ['wide', 'close', 'neutral', 'underhand'],
	'overhead-triceps-extension': ['rope', 'bar'],
	'pull-up': ['overhand', 'underhand', 'neutral'],
	'seated-cable-row': ['v-bar', 'wide', 'straight', 'rope'],
	'straight-arm-pulldown': ['bar', 'rope'],
	'triceps-pushdown': ['rope', 'bar', 'v-bar']
};

const offeredBy = (exercise: Exercise): Set<string> =>
	new Set(gripsOf(exercise).map((value) => value.id));

const retiredBy = (exercise: Exercise): Record<string, string> =>
	exercise.grips === undefined || exercise.grips.retired === undefined
		? {}
		: exercise.grips.retired;

describe('shipped grips', () => {
	it('are pinned for every axis the catalog has', () => {
		for (const exercise of catalog) {
			for (const grip of offeredBy(exercise)) {
				expect(SHIPPED_GRIPS[exercise.id] ?? [], exercise.id).toContain(grip);
			}
		}
	});

	it('each stay on their axis or name the value they were retired into', () => {
		for (const [id, grips] of Object.entries(SHIPPED_GRIPS)) {
			const exercise = catalogById[id];

			expect(exercise.grips, id).toBeDefined();

			for (const grip of grips) {
				const kept = offeredBy(exercise).has(grip) || Object.hasOwn(retiredBy(exercise), grip);

				expect(kept, `${id}: ${grip}`).toBe(true);
			}
		}
	});

	it('retire into a live value, and never retire one still offered', () => {
		for (const exercise of catalog) {
			const offered = offeredBy(exercise);

			for (const [from, to] of Object.entries(retiredBy(exercise))) {
				expect(offered.has(from), `${exercise.id}: ${from}`).toBe(false);
				expect(offered.has(to), `${exercise.id}: ${to}`).toBe(true);
				expect(settleGrip(exercise, from), `${exercise.id}: ${from}`).toBe(to);
			}
		}
	});

	it('give the seated row its rope back and read the straight bar as the wide one', () => {
		const row = catalogById['seated-cable-row'];

		expect(settleGrip(row, 'rope')).toBe('rope');
		expect(settleGrip(row, 'straight')).toBe('wide');
	});
});

describe('illustrations', () => {
	const shipped = new Set(drawn);

	it('draw every entry and every grip but the default', () => {
		for (const exercise of catalog) {
			expect(shipped.has(exercise.id), exercise.id).toBe(true);

			for (const value of exercise.grips?.values ?? []) {
				const name = `${exercise.id}--${value.id}`;

				if (value.id !== exercise.grips?.default) {
					expect(shipped.has(name), name).toBe(true);
				}
			}
		}
	});

	it('key a grip drawing on a real entry and one of its non-default values', () => {
		for (const name of drawn) {
			const [id = '', grip] = name.split('--');
			const axis = catalogById[id]?.grips;

			expect(catalogById[id], name).toBeDefined();

			if (grip !== undefined) {
				expect(
					axis?.values.some((value) => value.id === grip),
					name
				).toBe(true);
				expect(axis?.default, name).not.toBe(grip);
			}
		}
	});
});
