import { easeQuick, quickMs } from '$lib/ui/motion';

export function scrollParent(node: HTMLElement): HTMLElement {
	let current: HTMLElement | null = node;

	while (current !== null) {
		const overflow = getComputedStyle(current).overflowY;

		if (overflow === 'auto' || overflow === 'scroll') {
			return current;
		}

		current = current.parentElement;
	}

	return document.scrollingElement instanceof HTMLElement
		? document.scrollingElement
		: document.body;
}

function viewport(scroller: HTMLElement): { top: number; bottom: number } {
	return scroller === document.scrollingElement
		? { top: 0, bottom: window.innerHeight }
		: scroller.getBoundingClientRect();
}

/**
 * The element's own `scroll-margin`, in pixels.
 *
 * Reading it back off the computed style is what keeps the air a card claims
 * declared in one place — its class list — rather than restated as a constant
 * here that nobody would think to change with it. A computed `scroll-margin` is
 * always an absolute length, so trimming the unit is the whole parse.
 */
function px(length: string): number {
	return Number(length.replace('px', '')) || 0;
}

function margins(node: HTMLElement): { top: number; bottom: number } {
	const style = getComputedStyle(node);

	return { top: px(style.scrollMarginTop), bottom: px(style.scrollMarginBottom) };
}

export function fullyVisible(node: HTMLElement): boolean {
	const bounds = viewport(scrollParent(node));
	const rect = node.getBoundingClientRect();

	return rect.top >= bounds.top && rect.bottom <= bounds.bottom;
}

/**
 * One glide at a time, per app. Two reveals in flight would each be writing
 * `scrollTop` on the same frame from two different starting points, and the
 * pane would land wherever the later `requestAnimationFrame` happened to fire.
 */
let gliding: number | undefined;

/**
 * Move the scroller by `delta`, over the screen's one duration and curve.
 *
 * Hand-driven rather than `scrollIntoView({ behavior: 'smooth' })`, which is the
 * browser's duration and the browser's curve with no way to ask for either — and
 * the whole point here is that the pane travels on exactly the curve the cards
 * are changing height on. `scrollTop` is not an animatable property, so there is
 * no CSS route to it and no Web Animations route either; a frame loop is the
 * only way to spend a named easing on a scroll.
 *
 * `delta` is measured against the layout the caller can see *after* the update
 * that prompted the reveal, so the destination is already the final one even
 * while the heights along the way are still moving. What that costs is the last
 * frame: a scroller whose content is still growing clamps a `scrollTop` past its
 * current maximum, so the target is written once more on the frame after the
 * travel ends, when everything has settled and the clamp is gone.
 */
function glide(scroller: HTMLElement, delta: number): void {
	if (gliding !== undefined) {
		cancelAnimationFrame(gliding);
		gliding = undefined;
	}

	if (delta === 0) {
		return;
	}

	const ms = quickMs();
	const from = scroller.scrollTop;
	const to = from + delta;

	if (ms === 0) {
		scroller.scrollTop = to;

		return;
	}

	const start = performance.now();

	function frame(now: number): void {
		const t = Math.min(1, (now - start) / ms);

		scroller.scrollTop = from + delta * easeQuick(t);

		if (t < 1) {
			gliding = requestAnimationFrame(frame);

			return;
		}

		gliding = requestAnimationFrame(() => {
			gliding = undefined;
			scroller.scrollTop = to;
		});
	}

	gliding = requestAnimationFrame(frame);
}

/**
 * How far the pane is from having `node` where `block` asks for it — the same
 * arithmetic `scrollIntoView` performs internally, done by hand because a
 * scroll that animates on our own curve has to know the number rather than hand
 * the job over. `scroll-margin` is honoured the way the native call honours it,
 * which is what keeps `scroll-mt-3` on an exercise header meaning something.
 */
function shortfall(node: HTMLElement, block: 'start' | 'end' | 'nearest'): number {
	const bounds = viewport(scrollParent(node));
	const rect = node.getBoundingClientRect();
	const margin = margins(node);

	const top = rect.top - margin.top;
	const bottom = rect.bottom + margin.bottom;

	if (block === 'start') {
		return top - bounds.top;
	}

	if (block === 'end') {
		return bottom - bounds.bottom;
	}

	if (top < bounds.top) {
		return top - bounds.top;
	}

	if (bottom > bounds.bottom) {
		return bottom - bounds.bottom;
	}

	return 0;
}

function land(node: HTMLElement, block: 'start' | 'end' | 'nearest'): void {
	glide(scrollParent(node), shortfall(node, block));
}

/**
 * Bring `node` just inside its scroller — unless every pixel of it is already
 * on screen, in which case the page holds still.
 *
 * To the nearest edge, not to the centre. Centring moved the whole session
 * every time the editor grew by a line, and a page that jumps further than it
 * needed to costs the eye the same re-orientation whether it travelled 40px or
 * 400. `nearest` scrolls by the shortfall and no more, so a set that has half
 * left the bottom rises half a card and everything the thumb had its bearings
 * on is still where it was.
 */
export function revealNearest(node: HTMLElement): void {
	if (fullyVisible(node)) {
		return;
	}

	land(node, 'nearest');
}

/**
 * Bring `node`'s bottom edge up to the scroller's floor — with the same gate:
 * a node already fully on screen is left exactly where it is.
 *
 * This is the editors' focus reveal. Bottom-aligning is what serves a raised
 * keyboard — the commit bar under the fields is the very next tap, so it is
 * the edge worth paying for — but done unconditionally it also fired at a
 * desk, where no keyboard ever comes and every click into a field slid the
 * whole page for nothing. When the card is on screen and the keyboard does
 * rise, the browser's own scroll on the focused input takes over, and the
 * input's `scroll-mb` is what makes that native move carry the commit bar too.
 */
export function revealEnd(node: HTMLElement): void {
	if (fullyVisible(node)) {
		return;
	}

	land(node, 'end');
}

/**
 * Put `node`'s top edge at the top of its scroller, wherever it already was.
 *
 * Ungated on purpose, unlike the other two: this is the deliberate-arrival
 * reveal — a tap on an exercise in the session list — and a tap that names a
 * destination should land on it in the same place every time. The caller
 * decides when the pane is entitled to hold still instead; see the workout
 * screen, which spends `fullyVisible` on that question itself because what has
 * to be on screen there is two elements, not one.
 */
export function revealStart(node: HTMLElement): void {
	land(node, 'start');
}

/**
 * Reveal `from`'s top and `to`'s bottom together, moving the pane as little as
 * possible — and if the two cannot fit on screen at once, give up on `from`
 * and reveal `to` alone.
 *
 * This is `revealNearest` for a pair: the workout screen wants an exercise's
 * title and the set being logged inside it, and it wants the title *only while
 * it is free*. Six sets deep in an exercise the header no longer fits above the
 * live card, and holding on to it there would mean scrolling past the one thing
 * the screen exists for. So the span is measured first, and the set wins the
 * moment there is a conflict.
 */
export function revealSpan(from: HTMLElement, to: HTMLElement): void {
	const scroller = scrollParent(to);
	const bounds = viewport(scroller);

	const top = from.getBoundingClientRect().top - margins(from).top;
	const bottom = to.getBoundingClientRect().bottom + margins(to).bottom;

	if (bottom - top > bounds.bottom - bounds.top) {
		revealNearest(to);

		return;
	}

	if (top >= bounds.top && bottom <= bounds.bottom) {
		return;
	}

	glide(scroller, top < bounds.top ? top - bounds.top : bottom - bounds.bottom);
}
