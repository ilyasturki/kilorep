import type { ChartRange } from './bodyweight.ts';
import { isChartRange } from './bodyweight.ts';
import type { ExertionScale } from './exertion.ts';

/**
 * The id prefix the retired "main variant" preference was written under. The
 * feature is gone — which member heads a family is the catalog's fact again,
 * not the account's taste — but records written before it went are still on
 * devices and on the server, so the prefix outlives the type: it is what the
 * store matches to tombstone them.
 */
export const MAIN_VARIANT_PREFIX = 'main-variant:';

export type ExertionScalePreference = { scale: ExertionScale };

export const EXERTION_SCALE_ID = 'exertion-scale';

/**
 * How far back the Weight screen's trend is drawn, remembered.
 *
 * A record and not a `localStorage` key, which makes it sync — deliberately.
 * Somebody who reads their weight on a one-year window reads it that way on
 * every device they own, and the alternative is a phone and a laptop that
 * disagree about the same question for no reason a user could name.
 */
export type WeightRangePreference = { range: ChartRange };

export const WEIGHT_RANGE_ID = 'weight-range';

export type RestDefaultPreference = { enabled: boolean; seconds: number };

export const REST_DEFAULT_ID = 'rest-default';

/**
 * One exercise's own duration. `null` is not "unset" — it is *never rest on
 * this*, the exercise you circuit. Unset is the absence of the record, which
 * is what the tombstone leaves behind when an override is cleared.
 */
export type RestOverridePreference = { seconds: number | null };

/**
 * A record per exercise rather than one map of all of them, and the prefix is
 * what makes that affordable to read back.
 *
 * Sync is last-write-wins per record. A single map would have two devices
 * clobbering each other's unrelated edits every time they both set a duration —
 * the phone that set Deadlift to 3:30 would erase the laptop's Cable Fly the
 * moment their clocks disagreed. Keyed by catalog slug, which is append-only
 * and never reused, so an override cannot come to describe a different lift.
 */
export const REST_PREFIX = 'rest:';

export function restOverrideId(exerciseId: string): string {
	return `${REST_PREFIX}${exerciseId}`;
}

export function restOverrideExercise(id: string): string | null {
	return id.startsWith(REST_PREFIX) ? id.slice(REST_PREFIX.length) : null;
}

/**
 * One exercise's standing note — the seat number, the pin, which handles. The
 * only prose the user writes anywhere in the app.
 *
 * Two states and not three, unlike the rest override beside it: a note is
 * written or it is not, and "not" is the absence of the record. Empty text is
 * never stored — clearing tombstones instead, so a note taken back does not
 * ride sync forever as an empty string that every device has to keep.
 */
export type NotePreference = { text: string };

/**
 * Its own record per exercise, for the reason `REST_PREFIX` gives: sync is
 * last-write-wins per record, and one map of every note would have the phone
 * that reworded Bench Press erase the laptop's Cable Fly. Keyed by catalog
 * slug, which is append-only and never reused, so a note cannot come to
 * describe a different lift.
 */
export const NOTE_PREFIX = 'note:';

export function noteId(exerciseId: string): string {
	return `${NOTE_PREFIX}${exerciseId}`;
}

export function isExertionScalePreference(value: unknown): value is ExertionScalePreference {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		'scale' in value &&
		(value.scale === 'rpe' || value.scale === 'rir')
	);
}

function isPayload(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isWeightRangePreference(value: unknown): value is WeightRangePreference {
	return isPayload(value) && isChartRange(value.range);
}

export function isRestDefaultPreference(value: unknown): value is RestDefaultPreference {
	return (
		isPayload(value) &&
		typeof value.enabled === 'boolean' &&
		typeof value.seconds === 'number' &&
		Number.isFinite(value.seconds)
	);
}

export function isRestOverridePreference(value: unknown): value is RestOverridePreference {
	return (
		isPayload(value) &&
		'seconds' in value &&
		(value.seconds === null ||
			(typeof value.seconds === 'number' && Number.isFinite(value.seconds)))
	);
}

export function isNotePreference(value: unknown): value is NotePreference {
	return isPayload(value) && typeof value.text === 'string';
}
