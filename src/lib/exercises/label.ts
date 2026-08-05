import type { LoadMode } from '$lib/domain/exercise';
import type { PastSession } from '$lib/domain/stats';
import { bestSet } from '$lib/domain/stats';
import { formatSince } from '$lib/history/label';

const LOAD_MODE_NOTES: Record<LoadMode, string> = {
	total: '',
	'per-hand': 'per hand',
	unilateral: 'one side at a time'
};

export function loadModeNote(mode: LoadMode): string {
	return LOAD_MODE_NOTES[mode];
}

const LOAD_MODE_UNITS: Record<LoadMode, string> = {
	total: 'kg',
	'per-hand': 'kg / hand',
	unilateral: 'kg / side'
};

/**
 * What the weight field calls itself, which is where the load mode belongs on
 * the logging card: `per hand` was a note under the exercise name, two lines
 * above the box it governs, and the question it answers — *what number do I
 * type* — is asked with a thumb already on that box.
 *
 * `/ hand` and not `per hand`: the field is half the card wide, less two 44px
 * arms, which leaves about 72px for a `label-caps` line. Measured, `KG PER
 * HAND` does not fit there and `KG / HAND` does.
 *
 * Not `loadModeNote`. That one is prose for a page describing an exercise —
 * `one side at a time` reads as a sentence and would be nonsense as a unit.
 */
export function loadUnitLabel(mode: LoadMode): string {
	return LOAD_MODE_UNITS[mode];
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

	const best = bestSet(session.sets);

	return best === null ? undefined : `${best.weight} × ${best.reps}`;
}

export function lastSinceLabel(session: PastSession | undefined, now: number): string | undefined {
	return session === undefined ? undefined : formatSince(session.date, now);
}

const normalizeWord = (word: string): string => {
	const lower = word.toLowerCase();

	return lower === 'db' ? 'dumbbell' : lower;
};

export function variantLabel(variant: string, parent: string): string {
	const parentWords = new Set(parent.split(' ').map((word) => normalizeWord(word)));
	const kept = variant.split(' ').filter((word) => !parentWords.has(normalizeWord(word)));

	return kept.length === 0 ? variant : kept.join(' ');
}

const ORDINAL_SUFFIX: Record<string, string> = { one: 'st', two: 'nd', few: 'rd', other: 'th' };

const ordinalRules = new Intl.PluralRules('en', { type: 'ordinal' });

export function ordinal(n: number): string {
	return `${n}${ORDINAL_SUFFIX[ordinalRules.select(n)]}`;
}
