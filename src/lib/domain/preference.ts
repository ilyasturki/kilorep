/**
 * User preferences that sync as records — taste, not history. One record per
 * fact, keyed deterministically so re-choosing is a same-key upsert and
 * last-write-wins per record settles a disagreement between devices.
 *
 * Plain TypeScript with zero framework imports, per CLAUDE.md hard rule 1.
 * The `preference` record kind may grow other shapes later; the id prefix is
 * what tells them apart, and every reader guards the payload rather than
 * asserting it — a preference is authored on whichever device wrote it last,
 * possibly by a newer app than this one.
 */

import type { ExertionScale } from './exertion.ts';

/**
 * Which member of an exercise family leads it on this account. `family` is the
 * catalog's canonical parent slug — the stable name of the family, whoever
 * happens to headline it — and `main` is the member chosen to lead. Choosing
 * the canonical parent back is written like any other choice; readers treat
 * `main === family` as no preference at all, so there is no tombstone path.
 */
export type MainVariant = {
	family: string;
	main: string;
};

/** The record id for a family's choice — one per family, upsert by re-choosing. */
export function mainVariantId(family: string): string {
	return `main-variant:${family}`;
}

/** The read shape the browse fold consumes: family slug → chosen main slug. */
export type MainVariants = Record<string, string>;

/**
 * Which of the two names a set's rating wears — RPE or RIR. The number stored
 * on the set is the same either way; see `$lib/domain/exertion`, which owns
 * that rule and keeps the unit off the record.
 *
 * A record and not a device setting, because it is taste and taste is the
 * account's: a lifter who thinks in reps-in-reserve thinks that way on the
 * phone and on the desk, and one that had to be re-chosen per device would be
 * re-chosen wrong. There is exactly one, so the id is a constant rather than a
 * function of anything.
 */
export type ExertionScalePreference = { scale: ExertionScale };

export const EXERTION_SCALE_ID = 'exertion-scale';

/**
 * Whether a payload re-read from storage names a scale. A guard for the reason
 * `isMainVariant` is one, plus a second this shape has and that one does not:
 * the value is a closed union, so a future version that adds a third name would
 * otherwise widen this app's `scale` to a string it cannot render.
 */
export function isExertionScalePreference(value: unknown): value is ExertionScalePreference {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		'scale' in value &&
		(value.scale === 'rpe' || value.scale === 'rir')
	);
}

/**
 * Whether a payload re-read from storage is a `MainVariant`. A guard and not
 * an assertion, unlike the workout kinds' storage-boundary casts: this store
 * is *not* the only writer of the `preference` kind — a future app version on
 * another device is — so an unrecognised shape must fall out of the read, not
 * corrupt it.
 */
export function isMainVariant(value: unknown): value is MainVariant {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		'family' in value &&
		typeof value.family === 'string' &&
		value.family !== '' &&
		'main' in value &&
		typeof value.main === 'string' &&
		value.main !== ''
	);
}
