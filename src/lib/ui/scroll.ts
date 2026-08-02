/**
 * Bringing an element back on screen, but only when it actually left, and only
 * as far as it has to go.
 *
 * The workout pane used to pull the active set to centre; before that it did so
 * unconditionally, which meant tapping a row already on screen still slid the
 * whole page underneath the thumb. The visibility test is the fix for the
 * second half, and it lives beside the scroll it gates so no caller can take
 * one without the other.
 */

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
 *
 * The document scroller is measured as the viewport rather than by its rect:
 * `documentElement`'s box is the whole content, whose top goes negative as the
 * page scrolls, and testing against it would call everything visible.
 */
export function revealNearest(node: HTMLElement): void {
	const scroller = scrollParent(node);

	const bounds =
		scroller === document.scrollingElement
			? { top: 0, bottom: window.innerHeight }
			: scroller.getBoundingClientRect();

	const rect = node.getBoundingClientRect();

	if (rect.top >= bounds.top && rect.bottom <= bounds.bottom) {
		return;
	}

	node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
