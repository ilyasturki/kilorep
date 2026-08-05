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

export function isExertionScalePreference(value: unknown): value is ExertionScalePreference {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		'scale' in value &&
		(value.scale === 'rpe' || value.scale === 'rir')
	);
}
