import type { ExertionScale } from './exertion.ts';

export type MainVariant = {
	family: string;
	main: string;
};

export function mainVariantId(family: string): string {
	return `main-variant:${family}`;
}

export type MainVariants = Record<string, string>;

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
