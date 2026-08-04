/**
 * The nearest ancestor that scrolls, so the rail, the sheet and the pane all
 * work without being told which one they are. Falls back to the document,
 * which is what a list on an unconstrained page scrolls.
 */
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

/**
 * Whether every pixel of `node` sits inside its scroller, which is the gate
 * both reveals below share: a page that moves under a thumb that tapped
 * something already on screen is motion with nothing to justify it.
 *
 * The document scroller is measured as the viewport rather than by its rect:
 * `documentElement`'s box is the whole content, whose top goes negative as the
 * page scrolls, and testing against it would call everything visible.
 */
function fullyVisible(node: HTMLElement): boolean {
	const scroller = scrollParent(node);

	const bounds =
		scroller === document.scrollingElement
			? { top: 0, bottom: window.innerHeight }
			: scroller.getBoundingClientRect();

	const rect = node.getBoundingClientRect();

	return rect.top >= bounds.top && rect.bottom <= bounds.bottom;
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

	node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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

	node.scrollIntoView({ block: 'end', behavior: 'smooth' });
}
