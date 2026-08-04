/**
 * The catalog as data, checked against the spelling `search` actually compares.
 *
 * Every other test in this repo runs on a hand-made pool on purpose — the
 * matching rules must not move when the catalog grows. That leaves the catalog
 * file itself, seven hundred lines of hand-typed data, guarded by nothing. An
 * alias with a stray capital, a trailing space or a hyphen still fails no
 * build: `normalize` folds all three at query time, so the entry *works*, and
 * the file just quietly stops agreeing with itself about how an alias is
 * written. These pin the shape so the next hundred aliases are typed the way
 * the first hundred were.
 *
 * The one rule with teeth is the last: an alias identical to its own entry's
 * name earns nothing. `substringRank` gives a name match tier 0, better than
 * any alias can score, and it does so for every prefix of that name too — so
 * the duplicate is dead the day it is typed, and only ever rots into a
 * contradiction when the name is later fixed and the copy is not.
 */

import { describe, expect, it } from 'vitest';

import { catalog } from '$lib/catalog';

/**
 * `normalize` in `$lib/domain/search` is private, and deliberately so — this
 * is the one caller outside it that needs the same fold, and a copy here is
 * cheaper than an export that invites the screens to normalize things
 * themselves.
 */
function normalize(raw: string): string {
	return raw
		.toLowerCase()
		.normalize('NFD')
		.replaceAll(/[\u0300-\u036F]/gu, '')
		.replaceAll('-', ' ')
		.replaceAll(/\s+/gu, ' ')
		.trim();
}

describe('catalog aliases', () => {
	it('are already in their compared spelling', () => {
		for (const exercise of catalog) {
			for (const alias of exercise.aliases) {
				expect(alias, `${exercise.id}: ${JSON.stringify(alias)}`).toBe(normalize(alias));
			}
		}
	});

	it('carry no empty string', () => {
		for (const exercise of catalog) {
			for (const alias of exercise.aliases) {
				expect(alias.length, exercise.id).toBeGreaterThan(0);
			}
		}
	});

	it('name each spelling once per entry', () => {
		for (const exercise of catalog) {
			expect(new Set(exercise.aliases).size, exercise.id).toBe(exercise.aliases.length);
		}
	});

	it('never repeat the entry name they sit on', () => {
		for (const exercise of catalog) {
			expect(exercise.aliases, exercise.id).not.toContain(normalize(exercise.name));
		}
	});
});
