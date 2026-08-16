import type { Attachment } from 'svelte/attachments';
import { tapLift } from '$lib/ui/haptics';
import { coarsePointer } from '$lib/ui/pointer';

// Must match dragOrder.svelte.ts: one hold length and one slop across all gestures.
export const HOLD_MS = 500;
export const SLOP = 12;

const PRESSED = 'is-pressed';

type TrackerOptions = {
	mark: (pressed: boolean) => void;
	// `false` means nothing took the hold: the press and its click stay intact.
	hold?: () => boolean;
};

export class PressTracker {
	readonly #mark: (pressed: boolean) => void;
	readonly #hold: (() => boolean) | undefined;

	#timer: ReturnType<typeof setTimeout> | undefined;
	#pointerId = -1;
	#x = 0;
	#y = 0;

	#held = false;

	public constructor({ mark, hold }: TrackerOptions) {
		this.#mark = mark;
		this.#hold = hold;
	}

	public down(pointerId: number, x: number, y: number): void {
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
				this.#mark(false);
			}, HOLD_MS);
		}
	}

	public move(pointerId: number, x: number, y: number): void {
		if (pointerId !== this.#pointerId) {
			return;
		}

		// Touch implies pointer capture: moves keep arriving after the finger leaves the element.
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

// A getter, so the attachment effect does not take the handler's identity as a dependency.
type HoldSource = () => ((anchor: HTMLElement) => void) | undefined;

// Chrome on Android withholds `:active` while deciding whether a touch is a scroll, so the
// pressed class is driven from pointerdown instead.
export function press(holds?: HoldSource): Attachment<HTMLElement> {
	return (element) => {
		function onContextMenu(event: MouseEvent): void {
			const hold = holds === undefined ? undefined : holds();

			if (hold === undefined) {
				return;
			}

			// On touch this is Android offering text selection mid-hold.
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
		// Svelte delegates `onclick` to the app root, so a capturing element listener runs first.
		element.addEventListener('click', onClick, { capture: true, signal });

		return () => {
			listeners.abort();
			tracker.cancel();
			element.classList.remove(PRESSED);
		};
	};
}
