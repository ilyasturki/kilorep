/**
 * Catalog search: the Exercises screen and the mid-workout insert sheet.
 *
 * Two passes, not one scorer. The substring pass is the whole experience —
 * "ohp" under a sweaty thumb must hit Overhead Press instantly — and fuzzy
 * runs *only when substring finds nothing*, so a typo is caught but an exact
 * match is never polluted by lookalikes. A unified fuzzy ranking was
 * considered and rejected: mid-workout, a wrong match costs more than a
 * missed typo, because the wrong exercise's hint puts the wrong weight under
 * the user's thumb.
 *
 * Hand-rolled rather than a library at a catalog this size: the whole pool is
 * under a couple hundred entries, so the naive walk is instant and the
 * ranking rules stay ours to state and test.
 */

import type { Exercise } from '$lib/domain/exercise';

/**
 * One spelling for comparison: lowercase, diacritics stripped (é → e, so a
 * French alias and a bare keyboard agree), hyphens folded to spaces (the name
 * says "Close-Grip", the thumb types "close grip").
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

/**
 * Substring tiers, best first. A name hit outranks an alias hit at the same
 * shape because the name is what the row will actually show — a result whose
 * visible text starts with what was typed explains itself.
 */
function substringRank(query: string, name: string, aliases: string[]): number {
	if (name.startsWith(query)) {
		return 0;
	}

	if (name.split(' ').some((word) => word.startsWith(query))) {
		return 1;
	}

	if (aliases.some((a) => a.startsWith(query) || a.split(' ').some((w) => w.startsWith(query)))) {
		return 2;
	}

	if (name.includes(query)) {
		return 3;
	}

	if (aliases.some((a) => a.includes(query))) {
		return 4;
	}

	return -1;
}

/** Classic two-row Levenshtein. The pool is small; clarity beats cleverness. */
function editDistance(a: string, b: string): number {
	let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

	for (let i = 1; i <= a.length; i++) {
		const current = [i];

		for (let j = 1; j <= b.length; j++) {
			const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
			current.push(Math.min(previous[j] + 1, current[j - 1] + 1, substitution));
		}

		previous = current;
	}

	return previous[b.length];
}

/**
 * The closest any word of the name or aliases comes to the query. Words
 * rather than whole strings, because the typo is in the word being typed —
 * "bnech" is two edits from "bench" but eleven from "bench press".
 */
function bestDistance(query: string, name: string, aliases: string[]): number {
	const words = [name, ...name.split(' '), ...aliases.flatMap((a) => [a, ...a.split(' ')])];

	return Math.min(...words.map((word) => editDistance(query, word)));
}

/**
 * The pool, filtered and ranked for a query. An empty query returns the pool
 * untouched — "show everything" is the browse list's job, and it already has
 * an order of its own.
 *
 * Ties inside a tier break alphabetically, so two equally good matches sit in
 * the same order the browse list would show them.
 */
export function searchExercises(pool: Exercise[], query: string): Exercise[] {
	const q = normalize(query);

	if (q === '') {
		return pool;
	}

	// Normalized once for both passes — the fallback fires exactly while a typo
	// is on screen, and re-normalizing the pool there doubles the per-keystroke
	// work at its worst moment.
	const entries = pool.map((exercise) => ({
		exercise,
		name: normalize(exercise.name),
		aliases: exercise.aliases.map(normalize)
	}));

	const scored = entries
		.map(({ exercise, name, aliases }) => ({ exercise, rank: substringRank(q, name, aliases) }))
		.filter((s) => s.rank !== -1);

	if (scored.length > 0) {
		return scored
			.toSorted((a, b) => a.rank - b.rank || a.exercise.name.localeCompare(b.exercise.name))
			.map((s) => s.exercise);
	}

	// The fallback. One edit of tolerance for short queries, two beyond four
	// characters — looser than that and "curl" starts matching "core".
	const allowed = q.length <= 4 ? 1 : 2;

	return entries
		.map(({ exercise, name, aliases }) => ({
			exercise,
			distance: bestDistance(q, name, aliases)
		}))
		.filter((s) => s.distance <= allowed)
		.toSorted((a, b) => a.distance - b.distance || a.exercise.name.localeCompare(b.exercise.name))
		.map((s) => s.exercise);
}

/** A slice of the raw name, `start` inclusive to `end` exclusive. */
export type MatchRange = { start: number; end: number };

/**
 * Where the query sits inside the raw name, for a result row to mark. The
 * search compares normalized spellings, so the offset it finds indexes a
 * string the screen never shows — hyphens have become spaces, diacritics have
 * shed their marks — and has to be carried back through the folding to the
 * characters actually rendered.
 *
 * Null when the name simply does not contain the query: an alias hit or a
 * fuzzy save still lists the row, but text that is not on screen cannot be
 * marked honestly, so those rows wear no mark.
 */
export function matchRange(name: string, query: string): MatchRange | null {
	const q = normalize(query);

	if (q === '') {
		return null;
	}

	// The spelling `normalize` would produce, built one character at a time so
	// every normalized character remembers the raw index it came from.
	let text = '';
	const origin: number[] = [];

	for (let i = 0; i < name.length; i++) {
		const folded = name[i]
			.toLowerCase()
			.normalize('NFD')
			.replaceAll(/[\u0300-\u036F]/gu, '')
			.replaceAll('-', ' ');

		for (const char of folded) {
			if (/\s/u.test(char)) {
				// Collapse and trim exactly as `normalize` does: one plain space,
				// never a leading one or two in a row. A dangling trailing space
				// cannot matter — the query is trimmed, so no match ends on one.
				if (text === '' || text.endsWith(' ')) {
					continue;
				}

				text += ' ';
				origin.push(i);
				continue;
			}

			text += char;
			origin.push(i);
		}
	}

	const at = text.indexOf(q);

	if (at === -1) {
		return null;
	}

	return { start: origin[at], end: origin[at + q.length - 1] + 1 };
}
