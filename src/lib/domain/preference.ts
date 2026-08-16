import type { ChartRange } from './bodyweight.ts';
import { isChartRange } from './bodyweight.ts';
import type { ExertionScale } from './exertion.ts';

// Retired feature; old records still exist on devices and the server, and the store
// matches this prefix to tombstone them.
export const MAIN_VARIANT_PREFIX = 'main-variant:';

export type ExertionScalePreference = { scale: ExertionScale };

export const EXERTION_SCALE_ID = 'exertion-scale';

export type WeightRangePreference = { range: ChartRange };

export const WEIGHT_RANGE_ID = 'weight-range';

export type RestDefaultPreference = { enabled: boolean; seconds: number };

export const REST_DEFAULT_ID = 'rest-default';

// null = never rest on this exercise; "unset" is the absence of the record itself.
export type RestOverridePreference = { seconds: number | null };

// One record per exercise: sync is last-write-wins per record, so a single map
// would let two devices clobber each other's unrelated edits.
export const REST_PREFIX = 'rest:';

export function restOverrideId(exerciseId: string): string {
	return `${REST_PREFIX}${exerciseId}`;
}

export function restOverrideExercise(id: string): string | null {
	return id.startsWith(REST_PREFIX) ? id.slice(REST_PREFIX.length) : null;
}

// Empty text is never stored — clearing tombstones the record instead.
export type NotePreference = { text: string };

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
