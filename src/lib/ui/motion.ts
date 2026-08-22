import { prefersReducedMotion } from 'svelte/motion';

// The motion ladder, twinned with `--dur-*` / `--ease-*` in app.css — a JS animation cannot read a
// custom property, so both halves state it. Change a number here, change it there. The micro and
// large rungs live only in the stylesheet; nothing in JS drives a press or a page transition.
const DAMPING = 0.84;
const SMALL_RESPONSE = 0.3;
const MEDIUM_RESPONSE = 0.46;
const SMALL_MS = 225;
const MEDIUM_MS = 335;

// SwiftUI's spring as a 0 → 1 displacement. Underdamped throughout: at 0.84 the overshoot is 0.77%,
// under the 1% that would read as a bounce, which is why the ladder settles rather than springs.
function springAt(response: number, seconds: number): number {
	const w0 = (2 * Math.PI) / response;
	const wd = w0 * Math.sqrt(1 - DAMPING * DAMPING);
	const decay = Math.exp(-DAMPING * w0 * seconds);

	return 1 - decay * (Math.cos(wd * seconds) + ((DAMPING * w0) / wd) * Math.sin(wd * seconds));
}

// A spring is not expressible as a `cubic-bezier`; it is expressible as `linear()`.
function linearOf(response: number, ms: number, steps = 24): string {
	// The ends are written, not sampled: the spring is still 0.04% short of its target at `ms`, and a
	// `linear()` that does not reach 1 leaves the thing it moved a fraction of a pixel out of place.
	const points = [0];

	for (let i = 1; i < steps; i += 1) {
		points.push(Math.round(springAt(response, ((i / steps) * ms) / 1000) * 1e4) / 1e4);
	}

	points.push(1);

	return `linear(${points.join(', ')})`;
}

export const EASE_SMALL = linearOf(SMALL_RESPONSE, SMALL_MS);

export const EASE_MEDIUM = linearOf(MEDIUM_RESPONSE, MEDIUM_MS);

export function smallMs(): number {
	return prefersReducedMotion.current ? 0 : SMALL_MS;
}

export function mediumMs(): number {
	return prefersReducedMotion.current ? 0 : MEDIUM_MS;
}

// The spring as a plain function, for the animation that runs its own frame loop and cannot be
// handed a `linear()` string: `x` is progress through Medium's duration, not seconds.
export function easeMedium(x: number): number {
	return x >= 1 ? 1 : springAt(MEDIUM_RESPONSE, (x * MEDIUM_MS) / 1000);
}
