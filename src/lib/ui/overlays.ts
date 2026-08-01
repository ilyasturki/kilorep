/**
 * The overlays currently open, as the hardware back button sees them.
 *
 * Android's back means "leave the innermost thing first", and the innermost
 * thing is whatever panel is over the page — a sheet, a picker, a confirm.
 * Navigation cannot know that: overlays are component state, not routes. So
 * every overlay registers a closer while it is open, and the back handler in
 * `$lib/nav/hardware-back.ts` closes the top of the stack before it touches
 * the URL.
 *
 * Plain TS with no Capacitor in sight, on purpose: the components that
 * register here run on the web too, where nothing ever reads the stack, and a
 * registry this small is not worth a native import in every overlay. It is
 * a stack rather than a set because overlays nest — a confirm opened from a
 * sheet must go first — and "the top" is the registration order's tail.
 */

type Close = () => void;

const stack: Close[] = [];

/**
 * Called by an overlay when it opens. Returns the unregister function, shaped
 * for an `$effect` body: register on open, return the cleanup. Unregistering
 * twice — the closer ran, then the effect cleaned up — is harmless.
 */
export function registerOverlay(close: Close): () => void {
	stack.push(close);

	return () => {
		const index = stack.lastIndexOf(close);
		if (index !== -1) {
			stack.splice(index, 1);
		}
	};
}

export function hasOpenOverlay(): boolean {
	return stack.length > 0;
}

/**
 * Closes the most recently opened overlay. Returns whether there was one.
 *
 * Pops before calling: the closer flips the component's `open` back to false,
 * whose effect cleanup unregisters again — see above for why that is safe —
 * but a closer that somehow failed to clean up must not leave back-presses
 * hammering the same dead entry.
 */
export function closeTopOverlay(): boolean {
	const top = stack.pop();
	if (top === undefined) {
		return false;
	}

	top();
	return true;
}
