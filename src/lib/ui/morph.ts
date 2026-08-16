import { QUICK_EASE, quickMs } from '$lib/ui/motion';

type Pending = {
	node: HTMLElement;
	from: number;
};

let pending: Pending[] = [];
let scheduled = false;

const owners = new WeakMap<HTMLElement, Animation>();

// `finished` settles a microtask after the synchronous cancel, so only the animation still
// owning the node may clear the overflow its successor set.
async function release(node: HTMLElement, animation: Animation): Promise<void> {
	try {
		await animation.finished;
	} catch {
		// Cancelled.
	}

	if (owners.get(node) !== animation) {
		return;
	}

	owners.delete(node);
	node.style.overflow = '';
}

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

		if (Math.abs(to - from) < 1) {
			continue;
		}

		const running = owners.get(node);

		if (running !== undefined) {
			running.cancel();
		}

		node.style.overflow = 'hidden';

		const animation = node.animate([{ height: `${from}px` }, { height: `${to}px` }], {
			duration: ms,
			easing: QUICK_EASE
		});

		owners.set(node, animation);

		void release(node, animation);
	}
}

// Call from `$effect.pre`, while the DOM still holds the old content.
export function captureMorph(node: HTMLElement | undefined): void {
	if (node === undefined || pending.some((entry) => entry.node === node)) {
		return;
	}

	pending.push({ node, from: node.getBoundingClientRect().height });

	// A frame, not a microtask: rAF still lands before paint, so the new height is never seen.
	if (!scheduled) {
		scheduled = true;
		requestAnimationFrame(playMorphs);
	}
}
