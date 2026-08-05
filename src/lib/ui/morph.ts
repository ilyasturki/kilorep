import { QUICK_EASE, quickMs } from '$lib/ui/motion';

/**
 * A box whose contents are about to be replaced by something a different height,
 * animated from the height it had to the height it lands on.
 *
 * This exists for one swap: the workout screen's focused set, where a one-line
 * row becomes an editor four times its height and another editor collapses back
 * into a row at the same moment. Two `slide` transitions used to do it — one per
 * branch of an `{#if}` — and they played against each other with both cards in
 * the document at once, so the block swelled and settled back on every tap. Here
 * the element is the same element throughout: it is measured before the swap and
 * again after, and the difference between those two numbers is the only thing
 * that moves.
 *
 * The measurement is the whole reason this is a module rather than an
 * attachment. `from` has to be read before Svelte updates the DOM and `to` after,
 * and between those two moments the screen also has to decide where to scroll —
 * against the layout the swap produced, not against a box being held at its old
 * height. So capture and play are separate calls, and the screen orders them.
 */
type Pending = {
	node: HTMLElement;
	from: number;
};

let pending: Pending[] = [];
let scheduled = false;

/**
 * Whichever animation currently owns a node, so a swap that interrupts another
 * cannot have the loser's cleanup run after the winner's setup. `finished`
 * settles in a microtask, which is always later than the synchronous block that
 * cancelled it.
 */
const owners = new WeakMap<HTMLElement, Animation>();

/**
 * Give the node its overflow back, once this animation is done with it — however
 * it ended.
 *
 * The identity check is what makes an interrupted swap safe: `finished` settles
 * in a microtask, always later than the synchronous block that cancelled it and
 * started the next one, so a cancelled animation waking up to clean would be
 * clearing the `overflow: hidden` its successor had just set.
 */
async function release(node: HTMLElement, animation: Animation): Promise<void> {
	try {
		await animation.finished;
	} catch {
		// Cancelled — a second swap landed on this box mid-travel, and everything
		// below is now that one's to undo.
	}

	if (owners.get(node) !== animation) {
		return;
	}

	owners.delete(node);
	node.style.overflow = '';
}

/**
 * Start every captured box moving. Safe to call with nothing captured, and safe
 * to call twice — the queue empties on the first pass.
 */
export function playMorphs(): void {
	scheduled = false;

	const queued = pending;

	pending = [];

	const ms = quickMs();

	if (ms === 0) {
		return;
	}

	for (const { node, from } of queued) {
		const to = node.getBoundingClientRect().height;

		// Sub-pixel and identical heights are not motion, they are a repaint with
		// an animation attached — and `overflow: hidden` for 160ms is not free on a
		// box holding a focused input.
		if (Math.abs(to - from) < 1) {
			continue;
		}

		const running = owners.get(node);

		if (running !== undefined) {
			running.cancel();
		}

		// The height being animated is smaller than the content for most of the
		// travel, which is exactly what makes the growth read as a reveal rather
		// than a squash. Taken back off at the end, because a card that keeps
		// `overflow: hidden` clips the focus ring on its own fields.
		node.style.overflow = 'hidden';

		const animation = node.animate([{ height: `${from}px` }, { height: `${to}px` }], {
			duration: ms,
			easing: QUICK_EASE
		});

		owners.set(node, animation);

		void release(node, animation);
	}
}

/**
 * Remember what `node` measures now, before the change that is about to be
 * rendered into it. Call from `$effect.pre`, which is the one hook that runs
 * while the DOM still holds the old content.
 */
export function captureMorph(node: HTMLElement | undefined): void {
	if (node === undefined || pending.some((entry) => entry.node === node)) {
		return;
	}

	pending.push({ node, from: node.getBoundingClientRect().height });

	// The backstop, and the reason it is a frame and not a microtask: whoever
	// captured may not be on a screen that also reveals, and a height captured
	// and never played would be a swap that simply jumped. `requestAnimationFrame`
	// runs after every microtask — so a caller that means to play these itself,
	// from a `tick()` continuation, always gets there first — and still before the
	// browser paints, so the box is never seen at its new height first.
	if (!scheduled) {
		scheduled = true;
		requestAnimationFrame(playMorphs);
	}
}
