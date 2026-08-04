/**
 * How hard a set was, and the two languages for saying it.
 *
 * One number is stored, always on the RPE scale, and RIR is that same number
 * read from the other end — `10 − rpe`, which is the conversion every lifting
 * source uses and the one the user confirmed. Storing both, or storing a unit
 * beside the value, would let a record disagree with itself: an export row
 * saying `8` under a column header nobody exported, a set rated in RIR on the
 * phone and read in RPE on the desk. The scale is a preference about labels
 * and it never reaches the record.
 *
 * Plain TypeScript with zero framework imports, per CLAUDE.md hard rule 1. The
 * numbers are the domain's because the same rungs have to be offered by the
 * picker, honoured by the stepper and validated by whatever reads a record
 * another device wrote.
 */

export type ExertionScale = 'rpe' | 'rir';

/**
 * The stored range, in RPE. One rather than zero at the floor: RPE 0 is not a
 * set that was performed, and the scale has no meaning below "barely anything"
 * anyway — what a rating under 7 means in practice is "this was a warmup and I
 * am recording that it felt like one".
 */
export const EXERTION_MIN = 1;
export const EXERTION_MAX = 10;

/** Half steps, everywhere: the chips, the stepper, and what `settleExertion` rounds to. */
export const EXERTION_STEP = 0.5;

/**
 * The rungs the chip row offers, ascending in stored RPE.
 *
 * Seven, and none below 7: the low end of the scale is real but it is not what
 * a thumb reaches for between sets, and it stays reachable through the picker's
 * stepper. Half steps throughout, because 8.5-vs-9 is the distinction anybody
 * who bothers to rate a set is drawing.
 */
export const EXERTION_RUNGS: readonly number[] = [7, 7.5, 8, 8.5, 9, 9.5, 10];

/**
 * A rating the record can hold: clamped to the scale and rounded to the half
 * step.
 *
 * Shared by every way in — the chips can only produce rungs, but the stepper
 * arms, a typed entry and a payload pulled from another device can all produce
 * anything at all, and a rule applied by one and not the others would let the
 * picker disagree with what was stored.
 */
export function settleExertion(value: number): number {
	const stepped = Math.round(value / EXERTION_STEP) * EXERTION_STEP;

	return Math.min(EXERTION_MAX, Math.max(EXERTION_MIN, stepped));
}

/**
 * Whether a value off a record is a rating at all. Guarded rather than
 * asserted: workout payloads arrive over sync from app versions this one has
 * never met, and a rating of `"8"` or `NaN` must read as unrated rather than
 * reach the arithmetic.
 */
export function isExertion(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

/** The number the user sees, which is the stored one only under RPE. */
export function shownExertion(rpe: number, scale: ExertionScale): number {
	return scale === 'rpe' ? rpe : EXERTION_MAX - rpe;
}

/**
 * Back to what gets stored. The same subtraction — `10 − x` is its own inverse
 * — written as its own function anyway, because a caller reading `storedExertion`
 * at the picker's edge is saying which direction it is going, and that is the
 * thing that is easy to get backwards.
 */
export function storedExertion(shown: number, scale: ExertionScale): number {
	return scale === 'rpe' ? shown : EXERTION_MAX - shown;
}

/**
 * The bounds in the *shown* space, which is where the stepper works.
 *
 * RIR runs 0–9 rather than 0–10 for the same reason RPE stops at 1: they are
 * the same two ends of the same scale, named from opposite sides. Stepping in
 * the shown space is what makes the arms honest — `+` on RIR means an easier
 * set, and a control that moved the stored number instead would run backwards
 * under the label it is wearing.
 */
export function shownMin(scale: ExertionScale): number {
	return shownExertion(scale === 'rpe' ? EXERTION_MIN : EXERTION_MAX, scale);
}

export function shownMax(scale: ExertionScale): number {
	return shownExertion(scale === 'rpe' ? EXERTION_MAX : EXERTION_MIN, scale);
}

/** What the scale is called, on chips, labels and the settings row. */
export function scaleName(scale: ExertionScale): string {
	return scale === 'rpe' ? 'RPE' : 'RIR';
}

/**
 * A rating as a row or a pill spells it: `RPE 8`, `RIR 2`, null for unrated.
 *
 * Named rather than bare, in both scales. `8` alone beside `82.5 × 7` is a
 * third number on a row already carrying two, and at arm's length the eye has
 * nothing to tell it which one it is reading.
 *
 * Takes `undefined` as well as null, and tests with `isExertion` rather than
 * against null, because this is the one place both reading paths meet. The
 * projection in `$lib/store/derive` normalises the absent field on its way to
 * history, but a record read straight back out of the store is cast to its type
 * rather than checked against it — so a session logged before ratings existed
 * arrives here with no `rpe` key at all, and a bare null test would spell that
 * `RPE undefined`.
 */
export function exertionLabel(rpe: number | null | undefined, scale: ExertionScale): string | null {
	return isExertion(rpe) ? `${scaleName(scale)} ${shownExertion(rpe, scale)}` : null;
}

/**
 * The same fact appended to a recall line: `Last 82.5 × 7 · RPE 8`.
 *
 * Empty rather than null for an unrated set, because every caller is
 * concatenating — a null would have to be tested by each of them, and the one
 * that forgot would print the word.
 */
export function exertionSuffix(rpe: number | null | undefined, scale: ExertionScale): string {
	const label = exertionLabel(rpe, scale);

	return label === null ? '' : ` · ${label}`;
}
