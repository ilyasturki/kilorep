import type { Exercise, LoadMode } from '$lib/domain/exercise';
import { bodyweightShareOf, setLabel } from '$lib/domain/load';
import type { PastSession } from '$lib/domain/stats';
import { bestSet } from '$lib/domain/stats';
import type { PerformedSet } from '$lib/domain/workout';
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

const LOAD_MODE_UNITS_ADDED: Record<LoadMode, string> = {
	total: 'kg added',
	'per-hand': 'kg added / hand',
	unilateral: 'kg added / side'
};

export function loadUnitLabel(exercise: Exercise): string {
	const units = bodyweightShareOf(exercise) > 0 ? LOAD_MODE_UNITS_ADDED : LOAD_MODE_UNITS;

	return units[exercise.loadMode];
}

/** One decimal: a share of a body weight lands on fractions no scale claims to resolve. */
export function loadLabel(kg: number): string {
	return String(Math.round(kg * 10) / 10);
}

export { setLabel } from '$lib/domain/load';

/** The raw best under the name every screen gives it. */
export function bestLabel(exercise: Exercise, set: PerformedSet): string {
	if (bodyweightShareOf(exercise) > 0 && set.weight === 0) {
		return `Most reps ${set.reps}`;
	}

	return `Heaviest ${setLabel(exercise, set)}`;
}

/** A weight column's cell: `setLabel`'s rule for one number, `body` where nothing was added. */
export function addedLabel(exercise: Exercise, weight: number): string {
	if (bodyweightShareOf(exercise) === 0) {
		return String(weight);
	}

	return weight === 0 ? 'body' : `+${weight}`;
}

/**
 * A set split for a row's columns, by the rule `setLabel` follows. `load` reads in kilograms and
 * is `null` where the body is the whole load, so the row reads `8 reps`; `–` marks a blank.
 */
export function setFigures(
	exercise: Exercise,
	weight: number | null,
	reps: number | null
): { load: string | null; reps: string } {
	const shownReps = reps === null ? '–' : String(reps);

	if (weight === null) {
		return { load: '–', reps: shownReps };
	}

	if (bodyweightShareOf(exercise) === 0) {
		return { load: String(weight), reps: shownReps };
	}

	return { load: weight === 0 ? null : `+${weight}`, reps: shownReps };
}

export function lastSetLabel(
	exercise: Exercise,
	session: PastSession | undefined
): string | undefined {
	if (session === undefined) {
		return undefined;
	}

	const best = bestSet(session.sets);

	return best === null ? undefined : setLabel(exercise, best);
}

export function lastSinceLabel(session: PastSession | undefined, now: number): string | undefined {
	return session === undefined ? undefined : formatSince(session.date, now);
}

const ORDINAL_SUFFIX: Record<string, string> = { one: 'st', two: 'nd', few: 'rd', other: 'th' };

const ordinalRules = new Intl.PluralRules('en', { type: 'ordinal' });

export function ordinal(n: number): string {
	return `${n}${ORDINAL_SUFFIX[ordinalRules.select(n)]}`;
}
