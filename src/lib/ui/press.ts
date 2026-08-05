import type { Attachment } from 'svelte/attachments';
import { tapLift } from '$lib/ui/haptics';
import { coarsePointer } from '$lib/ui/pointer';

/**
 * Both numbers are `dragOrder.svelte.ts`'s, deliberately: a finger cannot be
 * told that one 500ms hold picks a row up and another opens its menu, and a
 * gesture that needed 12px of stillness on one screen and 8px on the next would
 * read as the app being unreliable rather than as two components.
 */
export const HOLD_MS = 500;
export const SLOP = 12;

const PRESSED = 'is-pressed';

type TrackerOptions = {
	mark: (pressed: boolean) => void;
	/**
	 * Asked at the moment the threshold passes, and answers whether anything
	 * took the hold. A `false` leaves the press exactly as it was — the finger is
	 * still down on something that turned out to have no menu behind it, and the
	 * click it ends with is an honest tap that must not be swallowed.
	 */
	hold?: () => boolean;
};

/**
 * The recognizer, with no DOM in it — the attachment below feeds it numbers and
 * turns its answers back into classes. Split that way because the interesting
 * behaviour is all timing and arithmetic, and vitest runs under Node with no
 * document to press.
 */
export class PressTracker {
	readonly #mark: (pressed: boolean) => void;
	readonly #hold: (() => boolean) | undefined;

	#timer: ReturnType<typeof setTimeout> | undefined;
	#pointerId = -1;
	#x = 0;
	#y = 0;

	/**
	 * A hold fired during this press, so the `click` the browser sends on release
	 * is the tail of a gesture that has already been answered. Survives `#release`
	 * — the click arrives after the pointerup that releases — and is cleared by
	 * the next press rather than by lifting, because a hold that ends with the
	 * finger dragged off the element produces no click at all, and a flag left
	 * standing would eat the next honest tap instead.
	 */
	#held = false;

	public constructor({ mark, hold }: TrackerOptions) {
		this.#mark = mark;
		this.#hold = hold;
	}

	public down(pointerId: number, x: number, y: number): void {
		// A second finger while one is already down is a pinch or a stray palm,
		// never a press. Ignoring it also keeps the first finger's press intact.
		if (this.#pointerId !== -1) {
			return;
		}

		this.#pointerId = pointerId;
		this.#x = x;
		this.#y = y;
		this.#held = false;

		this.#mark(true);

		if (this.#hold !== undefined) {
			const hold = this.#hold;

			this.#timer = setTimeout(() => {
				if (!hold()) {
					return;
				}

				this.#held = true;
				// The press state goes out at recognition rather than at lift: what
				// answers the finger now is the buzz and the surface about to open,
				// and a row left scaled down under its own menu reads as stuck.
				this.#mark(false);
			}, HOLD_MS);
		}
	}

	public move(pointerId: number, x: number, y: number): void {
		if (pointerId !== this.#pointerId) {
			return;
		}

		// Touch gives the element implicit pointer capture, so these keep arriving
		// after the finger has left the element — which is what makes travel, and
		// not `pointerleave`, the honest test for "this became a scroll".
		if (Math.hypot(x - this.#x, y - this.#y) > SLOP) {
			this.#release();
		}
	}

	public up(pointerId: number): void {
		if (pointerId === this.#pointerId) {
			this.#release();
		}
	}

	public cancel(): void {
		this.#release();
	}

	public swallowsClick(): boolean {
		const held = this.#held;

		this.#held = false;

		return held;
	}

	#release(): void {
		clearTimeout(this.#timer);
		this.#timer = undefined;
		this.#pointerId = -1;
		this.#mark(false);
	}
}

/**
 * Resolves what a hold on this element should open — `undefined` when nothing.
 *
 * A getter rather than the handler itself, and that is load-bearing.
 * Attachments are effects: whatever the `{@attach press(…)}` expression reads
 * while it runs becomes a dependency, and a re-run tears down every listener
 * and rebuilds it. Call sites pass inline arrows that Svelte mints afresh
 * whenever the row's data moves — `onoptions={(a) => onoptions(cursor.set.id, a)}`
 * changes identity on every set update — so reading the handler here would
 * churn listeners across every row in a live session, and cancel any press in
 * flight while it did. Behind a getter the read happens when the finger has
 * already been down half a second, which is nobody's effect.
 */
type HoldSource = () => ((anchor: HTMLElement) => void) | undefined;

/**
 * Instant press feedback, and the long press that grows out of it.
 *
 * The state is driven from `pointerdown` rather than left to `:active` because
 * Chrome on Android withholds `:active` for a beat while it decides whether the
 * touch is the start of a scroll. That hesitation is most of what makes a web
 * button feel like a web button — the tap lands, and the pixels agree a moment
 * later. Here the class goes on at touch-down and comes off the moment the
 * press travels far enough to be a scroll, which is the same judgement made
 * visibly early rather than invisibly late.
 *
 * Coarse pointers only. A mouse gets `:active`, which fires immediately and
 * carries the hover transitions the `press:` variant hands it — and a long
 * press with a mouse is not a gesture anyone makes, so `contextmenu` is what
 * opens the same surface there.
 */
export function press(holds?: HoldSource): Attachment<HTMLElement> {
	return (element) => {
		function onContextMenu(event: MouseEvent): void {
			const hold = holds === undefined ? undefined : holds();

			if (hold === undefined) {
				return;
			}

			// On touch this is Android offering to select text a third of the way
			// into a hold; on a mouse it is the right-click that stands in for one.
			event.preventDefault();

			if (!coarsePointer) {
				hold(element);
			}
		}

		const listeners = new AbortController();
		const { signal } = listeners;

		element.addEventListener('contextmenu', onContextMenu, { signal });

		if (!coarsePointer) {
			return () => {
				listeners.abort();
			};
		}

		function recognised(): boolean {
			const hold = holds === undefined ? undefined : holds();

			if (hold === undefined) {
				return false;
			}

			// Before the surface opens and while the finger is still down: the buzz
			// is the app saying it understood the gesture, which is only worth
			// anything if it beats the thing it is announcing.
			tapLift();
			hold(element);

			return true;
		}

		const tracker = new PressTracker({
			mark: (pressed: boolean): void => {
				element.classList.toggle(PRESSED, pressed);
			},
			hold: holds === undefined ? undefined : recognised
		});

		function onDown(event: PointerEvent): void {
			tracker.down(event.pointerId, event.clientX, event.clientY);
		}

		function onMove(event: PointerEvent): void {
			tracker.move(event.pointerId, event.clientX, event.clientY);
		}

		function onUp(event: PointerEvent): void {
			tracker.up(event.pointerId);
		}

		function onLostCapture(): void {
			// Something further up took the pointer — a drag lift, most likely — and
			// whatever this press was going to be, it is that gesture's now.
			tracker.cancel();
		}

		function onClick(event: MouseEvent): void {
			if (tracker.swallowsClick()) {
				event.preventDefault();
				event.stopImmediatePropagation();
			}
		}

		element.addEventListener('pointerdown', onDown, { signal });
		element.addEventListener('pointermove', onMove, { signal });
		element.addEventListener('pointerup', onUp, { signal });
		element.addEventListener('pointercancel', onUp, { signal });
		element.addEventListener('lostpointercapture', onLostCapture, { signal });
		// Svelte delegates `onclick` to a single listener at the app root, so any
		// listener on the element itself — capture or not — runs first, and halting
		// propagation here is what keeps the component's own handler from ever
		// seeing the click. Capture is belt and braces for the day that changes.
		element.addEventListener('click', onClick, { capture: true, signal });

		return () => {
			listeners.abort();
			tracker.cancel();
			element.classList.remove(PRESSED);
		};
	};
}
