import type { Exercise, LoadMode } from '$lib/domain/exercise';
import { bodyweightShareOf } from '$lib/domain/load';
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
