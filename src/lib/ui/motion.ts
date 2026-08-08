import { prefersReducedMotion } from 'svelte/motion';

/**
 * The app's two durations and one curve.
 *
 * Motion here is sorted by how far it goes, not by which component owns it. A
 * thing that rearranges in place is `QUICK_MS`; a thing that crosses the screen
 * is `TRAVEL_MS`. Before this there were nine numbers — 90, 100, 120, 150, 160,
 * 180, 200, 250, 500 — which is nine components each deciding what a moment is,
 * and the same act seen twice at two speeds reads as two acts.
 *
 * The curve is `--ease-sheet`, and both numbers are also `--dur-quick` and
 * `--dur-travel` in `app.css`. Spelled out in both places because a JS animation
 * cannot read a custom property that Tailwind resolves at build time — each pair
 * is one value and has to stay one value.
 */

/**
 * In-place motion: a card growing into an editor while another collapses, the
 * pane travelling to the live set, a set sliding into position, a block sliding
 * under a reorder, a dropdown falling open under its field.
 *
 * 160ms because most of this sits inside the logging loop and rule 7 is
 * watching: long enough to say which way the screen moved, short enough that a
 * thumb between sets never waits on it.
 */
export const QUICK_MS = 160;

/**
 * Screen-crossing motion: a page pushing on or popping off the stack, a sheet
 * rising from the bottom edge, a drawer, a dialog, the scrim under any of them.
 *
 * 20ms more than `QUICK_MS`, and the gap is the point rather than an accident.
 * These cover a whole viewport instead of a card's worth of height, and a full
 * screen width crossed in 160ms reads as a cut rather than a move — but two
 * durations a user can actually tell apart would be two motion systems. 180 is
 * far enough to keep the long travel legible and near enough that nobody can
 * name the difference.
 */
export const TRAVEL_MS = 180;

/** `--ease-sheet` in the form `Element.animate` and `transition` both accept. */
export const QUICK_EASE = 'cubic-bezier(0.2, 0.8, 0.3, 1)';

/**
 * The duration to actually use, which under reduced motion is none.
 *
 * A function and not a `$derived`, so imperative callers — `scroll.ts` mid
 * reveal, `morph.ts` mid swap — ask at the moment they animate. Reading
 * `.current` outside a reactive context is an ordinary media-query read; inside
 * a `$derived` it is also a subscription, which is what lets a component switch
 * its transition duration the moment the OS preference changes.
 */
export function quickMs(): number {
	return prefersReducedMotion.current ? 0 : QUICK_MS;
}

/** `TRAVEL_MS` under the same preference, on the same terms as `quickMs`. */
export function travelMs(): number {
	return prefersReducedMotion.current ? 0 : TRAVEL_MS;
}

/**
 * `QUICK_EASE` evaluated in JavaScript.
 *
 * CSS animates the card heights and the overview panel, and those get the curve
 * by name. The pane's scroll cannot: no CSS property animates `scrollTop`, and
 * `behavior: 'smooth'` is the browser's own duration and the browser's own
 * curve with no way to ask for either. So the scroll is driven frame by frame
 * and needs the same curve as a number — otherwise the heights and the travel
 * they cause would be two motions with one start and two shapes.
 *
 * A cubic-bezier maps x to y through a parameter t, and only t is solvable
 * directly, so `x(t) = x` is inverted by Newton–Raphson before `y(t)` is read.
 * Four passes from `t = x` is well inside a pixel over 160ms; the derivative
 * guard is for the flat spots where Newton would divide by zero rather than
 * converge.
 */
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
