import { prefersReducedMotion } from 'svelte/motion';

const LAYER = 'ripple-layer';

// A backstop, not a timing: the fade's own `transitionend` is what normally removes a drop,
// and this catches the cases where that event never arrives — an ancestor hidden mid-press,
// a tab backgrounded, a transition the compositor drops. Generous on purpose.
const STRANDED_MS = 1000;

/**
 * Where a ripple belongs, marked in the markup rather than decided here.
 *
 * `press` is attached to 56 things, and most of them are wrong for this: a stepper held
 * down, a ruler under a scrubbing thumb, a switch. Android does not ripple those either.
 * So `data-ripple` is opt-in, and it names the surface the circle is clipped to, which is
 * not always the element the finger is on — the nav bar's pill is a child of the tab.
 */
function hostFor(element: HTMLElement): HTMLElement | null {
	return element.matches('[data-ripple]')
		? element
		: element.querySelector<HTMLElement>('[data-ripple]');
}

function layerIn(host: HTMLElement): HTMLElement {
	const existing = host.querySelector<HTMLElement>(`:scope > .${LAYER}`);

	if (existing !== null) {
		return existing;
	}

	const layer = document.createElement('span');

	layer.className = LAYER;
	// Out of the accessibility tree and out of the way of the tap that spawned it: the
	// click Svelte delegates to the app root has to reach the button, not this.
	layer.ariaHidden = 'true';

	host.append(layer);

	return layer;
}

/**
 * One press's circle, from the point the finger landed.
 *
 * Held rather than fired and forgotten because the release is a second act: the drop grows
 * on its own, and the finger going is what fades it.
 */
export class Ripple {
	readonly #element: HTMLElement;

	#drop: HTMLElement | undefined;

	public constructor(element: HTMLElement) {
		this.#element = element;
	}

	public spawn(clientX: number, clientY: number): void {
		// The one ladder rung that is a real animation rather than a state change, so it is
		// the one that has to answer for itself. Under reduced motion a circle appearing at
		// full size is not a quieter ripple, it is a flash: nothing is drawn at all, and the
		// tint `press:` paints is the whole of the feedback.
		if (prefersReducedMotion.current) {
			return;
		}

		const host = hostFor(this.#element);

		if (host === null) {
			return;
		}

		const box = host.getBoundingClientRect();
		const x = clientX - box.left;
		const y = clientY - box.top;

		// Out to the farthest corner, which is what makes the sweep cover the whole surface
		// however off-centre the thumb landed.
		const radius = Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height - y));

		const drop = document.createElement('span');

		drop.className = 'ripple-drop';
		drop.style.left = `${x - radius}px`;
		drop.style.top = `${y - radius}px`;
		drop.style.width = `${radius * 2}px`;
		drop.style.height = `${radius * 2}px`;

		layerIn(host).append(drop);

		this.#drop = drop;
	}

	public release(): void {
		const drop = this.#drop;

		if (drop === undefined) {
			return;
		}

		// Let go of it here rather than when it lands: from now on this drop is fading on its
		// own, and the next press wants a clear slot rather than the right to cancel this one.
		this.#drop = undefined;

		const stranded = setTimeout(() => {
			drop.remove();
		}, STRANDED_MS);

		drop.addEventListener(
			'transitionend',
			() => {
				clearTimeout(stranded);
				drop.remove();
			},
			{ once: true }
		);

		drop.classList.add('is-fading');
	}
}
