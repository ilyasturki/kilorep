/**
 * Per-exercise stats: the raw PR the exercise detail headlines, and the
 * estimated 1RM the Dashboard reads as a trend signal. The Dashboard's own
 * derivations — main lifts, the habit, muscle balance — live in
 * `$lib/domain/dashboard`; this module stays about one exercise at a time.
 */

import type { PerformedSet } from '$lib/domain/workout';

/**
 * Whole past sessions of one exercise, oldest first — the shape the exercise
 * detail renders and this module's functions read. Derived from finished
 * workouts by the store — see `$lib/store/derive`.
 *
 * `workoutId` names the finished workout the session came from — the record
 * `/history/:id` renders — and `position` is the exercise's 1-based place
 * among that workout's exercises, in session order. Every exercise the
 * workout holds counts toward the ordinal, performed or not: "4th exercise"
 * must mean the 4th thing on the screen the id links to.
 */
export type PastSession = {
	date: number;
	workoutId: string;
	position: number;
	sets: PerformedSet[];
};

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
 * Epley: weight × (1 + reps ⁄ 30). PRODUCT.md's one formula, and a trend
 * signal only — the headline stays `rawPr`'s raw number, no formula. A single
 * estimates the weight itself: the formula's +1⁄30 on one rep is an artifact
 * of its shape, not an estimate of anything — you lifted it once, that is
 * what a 1RM is.
 */
export function estimated1Rm(set: PerformedSet): number {
	return set.reps <= 1 ? set.weight : set.weight * (1 + set.reps / 30);
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
