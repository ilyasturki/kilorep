import { prefersReducedMotion } from 'svelte/motion';

// Mirrors `--dur-quick` / `--dur-travel` / `--ease-sheet` in app.css — keep each pair in
// sync; a JS animation cannot read the custom property.
export const QUICK_MS = 160;

export const TRAVEL_MS = 180;

export const QUICK_EASE = 'cubic-bezier(0.2, 0.8, 0.3, 1)';

export function quickMs(): number {
	return prefersReducedMotion.current ? 0 : QUICK_MS;
}

export function travelMs(): number {
	return prefersReducedMotion.current ? 0 : TRAVEL_MS;
}

const X1 = 0.2;
const Y1 = 0.8;
const X2 = 0.3;
const Y2 = 1;

function bezier(p1: number, p2: number, t: number): number {
	const c = 3 * p1;
	const b = 3 * (p2 - p1) - c;
	const a = 1 - c - b;

	return ((a * t + b) * t + c) * t;
}

function slope(p1: number, p2: number, t: number): number {
	const c = 3 * p1;
	const b = 3 * (p2 - p1) - c;
	const a = 1 - c - b;

	return (3 * a * t + 2 * b) * t + c;
}

// `QUICK_EASE` as a function: x(t)=x inverted by Newton–Raphson, four passes from t=x.
export function easeQuick(x: number): number {
	let t = x;

	for (let pass = 0; pass < 4; pass += 1) {
		const derivative = slope(X1, X2, t);

		if (Math.abs(derivative) < 1e-6) {
			break;
		}

		t -= (bezier(X1, X2, t) - x) / derivative;
	}

	return bezier(Y1, Y2, t);
}
