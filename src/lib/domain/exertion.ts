export type ExertionScale = 'rpe' | 'rir';

export const EXERTION_MIN = 1;
export const EXERTION_MAX = 10;

export const EXERTION_STEP = 0.5;

/**
 * The ratings the picker offers as one tap, which is not the whole scale.
 *
 * The top of it, because a working set below RPE 7 is rare enough to type. 7.5
 * is the one gap inside the range, and it is the price of the dash that clears
 * a rating: the grid holds eight and the eighth had to be one of them. Every
 * half-step either way is still reachable through the picker's own field —
 * `EXERTION_STEP` is what the chips skip, not what the domain stores.
 */
export const EXERTION_RUNGS: readonly number[] = [7, 8, 8.5, 9, 9.5, 10];

export function settleExertion(value: number): number {
	const stepped = Math.round(value / EXERTION_STEP) * EXERTION_STEP;

	return Math.min(EXERTION_MAX, Math.max(EXERTION_MIN, stepped));
}

export function isExertion(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

export function shownExertion(rpe: number, scale: ExertionScale): number {
	return scale === 'rpe' ? rpe : EXERTION_MAX - rpe;
}

export function storedExertion(shown: number, scale: ExertionScale): number {
	return scale === 'rpe' ? shown : EXERTION_MAX - shown;
}

export function shownMin(scale: ExertionScale): number {
	return shownExertion(scale === 'rpe' ? EXERTION_MIN : EXERTION_MAX, scale);
}

export function shownMax(scale: ExertionScale): number {
	return shownExertion(scale === 'rpe' ? EXERTION_MAX : EXERTION_MIN, scale);
}

export function scaleName(scale: ExertionScale): string {
	return scale === 'rpe' ? 'RPE' : 'RIR';
}

export function exertionLabel(rpe: number | null | undefined, scale: ExertionScale): string | null {
	return isExertion(rpe) ? `${scaleName(scale)} ${shownExertion(rpe, scale)}` : null;
}

export function exertionSuffix(rpe: number | null | undefined, scale: ExertionScale): string {
	const label = exertionLabel(rpe, scale);

	return label === null ? '' : ` · ${label}`;
}
