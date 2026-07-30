/**
 * The stats the exercise detail carries. Deliberately this small: volume math
 * and the est-1RM trend answer to Dashboard, which has not been designed, and
 * writing them here would be guessing at its questions.
 */

import type { PerformedSet } from '$lib/domain/workout';

/**
 * Whole past sessions of one exercise, oldest first — the shape the exercise
 * detail renders and this module's functions read. Authored in the fixture for
 * now; the store takes both over when it lands.
 */
export type PastSession = { date: number; sets: PerformedSet[] };

/**
 * The raw PR: heaviest weight ever lifted, tie-broken by reps at that load.
 * No formula — PRODUCT.md is explicit that estimated 1RM is a trend signal,
 * never the headline. Ties after reps keep the *first* achievement, because a
 * PR is a date as much as a number and matching it later does not move it.
 *
 * Takes the flat performed sets, not sessions: whose sets count (completed
 * working sets only) is the caller's rule, decided where the sets are read
 * out of history.
 */
export function bestSet(sets: PerformedSet[]): PerformedSet | null {
	let best: PerformedSet | null = null;

	for (const set of sets) {
		if (
			best === null ||
			set.weight > best.weight ||
			(set.weight === best.weight && set.reps > best.reps)
		) {
			best = set;
		}
	}

	return best;
}

/**
 * The raw PR and the session it was set in. `bestSet` keeps the first
 * achievement, so with sessions oldest first the set it returns already
 * belongs to the oldest holder — found here by identity, which is what makes
 * "matching it later does not move it" structural rather than re-derived by
 * value.
 */
export function rawPr(sessions: PastSession[]): { set: PerformedSet; date: number } | null {
	const best = bestSet(sessions.flatMap((session) => session.sets));

	if (best === null) {
		return null;
	}

	const holder = sessions.find((session) => session.sets.includes(best));

	return holder === undefined ? null : { set: best, date: holder.date };
}
