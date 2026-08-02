/**
 * How an exercise introduces itself under its own name, in both of the ways a
 * row can mean something.
 *
 * A row that is a **choice** — the catalog list, the insert sheet, the family
 * links on the detail — answers "which of these am I doing today", and the
 * deciding fact is what you last lifted and how long ago. A row that is
 * **identity** — the detail's own header, a group in a finished workout, a
 * group in a template — is already about one exercise, so it carries only the
 * load mode, and only when there is one to carry.
 *
 * Equipment appears in neither, deliberately. The catalog names anything but
 * the default implement (`Dumbbell Bench Press`, `Cable Fly`), so the field
 * either repeats the line above it or states what the reader assumed.
 *
 * Plain TypeScript — strings out, no framework in, same bargain as
 * `$lib/history/label`.
 */

import type { LoadMode } from '$lib/domain/exercise';
import type { PastSession } from '$lib/domain/stats';
import { bestSet } from '$lib/domain/stats';
import { formatSince } from '$lib/history/label';

const LOAD_MODE_NOTES: Record<LoadMode, string> = {
	// Total says nothing: it is the unmarked case, and naming it would make
	// every barbell entry carry a word that only matters by its absence.
	total: '',
	'per-hand': 'per hand',
	unilateral: 'one side at a time'
};

/**
 * The half of the old equipment line that is arithmetic rather than
 * description: per-hand and unilateral both double volume (CLAUDE.md's rule),
 * so a screen showing `20 × 12` without this is showing a number that does not
 * mean what it looks like. Empty for `total`, and callers render nothing
 * rather than an empty line.
 */
export function loadModeNote(mode: LoadMode): string {
	return LOAD_MODE_NOTES[mode];
}

/**
 * Last time's heaviest set, spelled the way the workout screen spells a hint.
 * `bestSet`'s rule — heaviest, tie-broken by reps — rather than the last set
 * of the session, because a session that ended on a back-off set is not
 * described by it.
 *
 * The `×` is the character `hintLabel` uses, and for the same reason: the
 * vendored font subset carries it.
 */
export function lastSetLabel(session: PastSession | undefined): string | undefined {
	if (session === undefined) {
		return undefined;
	}

	// `performedSets` only ever fills a session that had sets, so this is the
	// type's null case and not a state the store can produce.
	const best = bestSet(session.sets);

	return best === null ? undefined : `${best.weight} × ${best.reps}`;
}

/** How long since that session — `undefined` when the exercise has no past. */
export function lastSinceLabel(session: PastSession | undefined, now: number): string | undefined {
	return session === undefined ? undefined : formatSince(session.date, now);
}

// `DB` is the one abbreviation the catalog uses in names, so it must compare
// equal to the word it stands for — without this, "Incline DB Press" under
// "Dumbbell Bench Press" keeps a stray "DB" on its chip.
const normalizeWord = (word: string): string => {
	const lower = word.toLowerCase();

	return lower === 'db' ? 'dumbbell' : lower;
};

/**
 * What a variant's chip says under its parent's row: the words of its name the
 * parent's name does not already carry — "Close-Grip Bench Press" under
 * "Bench Press" is just "Close-Grip". A variant sharing no words with its
 * parent (Chin-Up under Pull-Up) keeps its full name, which is also the honest
 * fallback for any future naming this rule does not anticipate.
 */
export function variantLabel(variant: string, parent: string): string {
	const parentWords = new Set(parent.split(' ').map(normalizeWord));
	const kept = variant.split(' ').filter((word) => !parentWords.has(normalizeWord(word)));

	return kept.length === 0 ? variant : kept.join(' ');
}

const ORDINAL_SUFFIX: Record<string, string> = { one: 'st', two: 'nd', few: 'rd', other: 'th' };

const ordinalRules = new Intl.PluralRules('en', { type: 'ordinal' });

/** `4` → `4th`, with the 21st/22nd/23rd endings `Intl` knows and a lookup would botch. */
export function ordinal(n: number): string {
	return `${n}${ORDINAL_SUFFIX[ordinalRules.select(n)]}`;
}
