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
