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
 * `scrollIntoView` honours it for free; a scroll computed by hand has to ask.
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
 * Every reveal in this file lands instantly, and none of them animate.
 *
 * A scroll that travels is a scroll the eye has to follow, and the app's motion
 * is meant to be felt rather than watched. The distances here are also the
 * wrong ones to animate: arriving on the workout screen the pane has to cross
 * the whole session to reach the live set, and 400ms of that is the first thing
 * a returning user sees for no information at all — the set was always going to
 * be there. `instant` and not `auto`, so a `scroll-behavior: smooth` set in CSS
 * later cannot quietly put the animation back.
 */
function land(node: HTMLElement, block: ScrollLogicalPosition): void {
	node.scrollIntoView({ block, behavior: 'instant' });
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
 * on is still where it was. It also honours `scroll-margin`, which is how the
 * active card's `scroll-mb-3` buys its own strip of air at the floor.
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

	scroller.scrollBy({
		top: top < bounds.top ? top - bounds.top : bottom - bounds.bottom,
		behavior: 'instant'
	});
}
