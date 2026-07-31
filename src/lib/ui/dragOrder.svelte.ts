/**
 * Drag-to-reorder for a vertical list: the mechanics, none of the meaning.
 *
 * It knows about pointers, rectangles and scroll edges. It does not know what
 * is in the list — the caller reads the live order out of wherever it lives and
 * performs the move, so the tree stays owned by the domain and this file stays
 * a gesture.
 *
 * Two ways in, one lift. A handle lifts on contact, because a control whose
 * only job is dragging has nothing to disambiguate. Anywhere else on the row
 * lifts on a 500ms hold — the same threshold `SetRow` uses, since both are a
 * hold that opens something rather than a hold that accelerates.
 *
 * The list reorders live, on every midpoint crossing, so the drop has nothing
 * left to do. What that costs is a cancel path: the index the row started at is
 * remembered, and Escape puts it back.
 *
 * Rows are assumed to be of a uniform height. The slot geometry is measured
 * once at lift and stays valid for the whole drag on that assumption — which is
 * what lets the list rearrange underneath without the arithmetic chasing it.
 * It is also what bounds the travel: the row in hand cannot be dragged past the
 * first or last slot, because there is nothing further for it to say.
 */

import { tapLift } from '$lib/ui/haptics';

export type DragOrderOptions = {
	/** The rendered ids, top to bottom, read live on every frame. */
	order: () => string[];
	/** Put `id` at `index`. Whether anything moved. */
	move: (id: string, index: number) => boolean;
	/**
	 * A row has just been picked up. Optional, and fired once per lift.
	 *
	 * The moment a row is in hand it is the row being talked about, so a list
	 * whose selection means something elsewhere on the screen can follow it —
	 * rather than showing whatever was selected before the drag started and
	 * catching up only if the user taps afterwards.
	 */
	lift?: (id: string) => void;
};

/** Matches `SetRow`'s long-press: a hold that opens something, not one that accelerates. */
const HOLD_LIFT = 500;

/**
 * Registered on the document for the length of a lift, non-passive so it can
 * actually refuse the pan the browser would otherwise perform.
 */
function refuse(event: TouchEvent): void {
	event.preventDefault();
}

/** How close to an edge auto-scroll starts, and how fast it gets at the very edge. */
const EDGE = 48;
const EDGE_SPEED = 14;

/**
 * The nearest ancestor that scrolls, so the rail and the sheet both work
 * without either of them being told which one they are. Falls back to the
 * document, which is what a list on an unconstrained page scrolls.
 */
function scrollParent(node: HTMLElement): HTMLElement {
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

export class DragOrder {
	/** The list wrapper. Rows inside it are found by their `data-drag-id`. */
	public root: HTMLElement | null = $state(null);

	/** The row in hand, or null. Drives the lifted styling. */
	public liftedId: string | null = $state(null);

	/**
	 * What the lifted row's inner element is translated by, in px.
	 *
	 * Recomputed every frame against the row's *live* rect rather than
	 * accumulated from pointer deltas, which is what makes it immune to
	 * `animate:flip`: the flip transform moves the outer element, this
	 * measures where that landed, and the row stays under the finger through an
	 * animation it knows nothing about.
	 */
	public offset: number = $state(0);

	// None of these render, so none of them is `$state`.
	readonly #options: DragOrderOptions;
	#scroller: HTMLElement | null = null;
	#slots: number[] = [];
	#height = 0;
	#grab = 0;
	#pointerY = 0;
	#pointerId = -1;
	#origin = 0;
	#frame: number | undefined;
	#hold: ReturnType<typeof setTimeout> | undefined;
	#lifted = false;

	/**
	 * Construct during component initialisation — the teardown below is an
	 * `$effect`, and a drag left running past its list would keep calling `move`
	 * against a tree nobody is rendering.
	 */
	public constructor(options: DragOrderOptions) {
		this.#options = options;

		$effect(() => () => {
			this.#end();
		});
	}

	/** Whether a row is the one in hand. */
	public isLifted(id: string): boolean {
		return this.liftedId === id;
	}

	/**
	 * A press on the handle, which lifts immediately.
	 *
	 * `touch-action: none` on the handle itself is what keeps the browser from
	 * claiming the gesture as a scroll — scoped there so the list still pans
	 * normally everywhere else.
	 */
	public handleDown(event: PointerEvent, id: string): void {
		this.#arm(event);
		this.#lift(event, id);
	}

	/** A press on the row, which lifts only if it is still held at 500ms. */
	public rowDown(event: PointerEvent, id: string): void {
		this.#arm(event);
		this.#hold = setTimeout(() => {
			this.#lift(event, id);
		}, HOLD_LIFT);
	}

	/** Every way a press ends: released, dragged off, or taken by the browser. */
	public up(): void {
		clearTimeout(this.#hold);
		this.#end();
	}

	public move(event: PointerEvent): void {
		this.#pointerY = event.clientY;
	}

	/**
	 * Escape puts the row back where it was lifted from.
	 *
	 * The only thing a live reorder costs: with the tree already rewritten on
	 * every crossing, undoing is a move rather than a discarded draft.
	 */
	public cancel(): void {
		if (this.liftedId !== null) {
			this.#options.move(this.liftedId, this.#origin);
		}

		clearTimeout(this.#hold);
		this.#end();
	}

	/**
	 * Whether the click ending this gesture should be swallowed.
	 *
	 * A long-press that lifted a row still produces a click on release, and the
	 * row underneath jumps the session to an exercise. `detail` is 0 for a
	 * keyboard activation and non-zero for a pointer's, so the swallow can only
	 * ever eat the click it was meant for.
	 */
	public swallowClick(event: MouseEvent): boolean {
		if (!this.#lifted || event.detail === 0) {
			return false;
		}

		this.#lifted = false;

		return true;
	}

	#arm(event: PointerEvent): void {
		clearTimeout(this.#hold);
		this.#lifted = false;
		this.#pointerId = event.pointerId;
		this.#pointerY = event.clientY;
	}

	#rowFor(id: string): HTMLElement | null {
		return this.root?.querySelector(`[data-drag-id="${CSS.escape(id)}"]`) ?? null;
	}

	#lift(event: PointerEvent, id: string): void {
		const row = this.#rowFor(id);

		if (this.root === null || row === null) {
			return;
		}

		const scroller = scrollParent(this.root);
		const bounds = scroller.getBoundingClientRect();
		const rows = [...this.root.querySelectorAll<HTMLElement>('[data-drag-id]')];

		// Slot centres in the scroller's content coordinates, so auto-scrolling
		// mid-drag moves the pointer through them rather than dragging them along.
		this.#slots = rows.map((node) => {
			const box = node.getBoundingClientRect();

			return box.top - bounds.top + scroller.scrollTop + box.height / 2;
		});

		const box = row.getBoundingClientRect();

		this.#scroller = scroller;
		this.#height = box.height;
		this.#grab = this.#pointerY - box.top;
		this.#origin = this.#options.order().indexOf(id);
		this.#lifted = true;
		this.liftedId = id;
		this.offset = 0;

		// A hold has nothing on screen to say it registered until the row moves,
		// and by then the user has already started guessing.
		tapLift();

		// After the lift is fully built, so a handler that reaches back into this
		// list — the workout screen jumps to the exercise it just picked up — finds
		// a drag already in hand rather than one half-assembled.
		this.#options.lift?.(id);

		// The capture keeps the moves coming after the pointer leaves the row it
		// started on, which it does immediately — the row is what moves. It is
		// taken against `target` and not `currentTarget`, because the long-press
		// path reads this event half a second after dispatch, by which time the
		// browser has already nulled `currentTarget`.
		//
		// Not fatal if it is refused. `setPointerCapture` throws when the pointer
		// is no longer active, and a lift is already half-built by this line — an
		// exception here would leave a row marked lifted with nothing driving it
		// and no way to put it down. Without the capture the drag still works for
		// as long as the pointer stays over the list, which is the ordinary case.
		try {
			if (event.target instanceof Element) {
				event.target.setPointerCapture(this.#pointerId);
			}
		} catch {
			// Deliberately silent — see above.
		}

		// Non-passive, so it can actually refuse the pan. Registering it only now
		// is what makes that stick: a lift follows 500ms of a stationary finger,
		// so the browser has not yet committed to a scroll it would be too late to
		// take back. The handle path never needs this — `touch-action: none` on
		// the handle has already said the same thing in CSS.
		document.addEventListener('touchmove', refuse, { passive: false });

		this.#frame = requestAnimationFrame(this.#tick);
	}

	readonly #tick = (): void => {
		const id = this.liftedId;
		const scroller = this.#scroller;

		if (id === null || scroller === null) {
			return;
		}

		const bounds = scroller.getBoundingClientRect();

		// Auto-scroll, ramping with proximity so the last few pixels of travel are
		// the fast ones and a pointer parked just inside the band crawls.
		const above = this.#pointerY - bounds.top;
		const below = bounds.bottom - this.#pointerY;

		if (above < EDGE) {
			scroller.scrollTop -= EDGE_SPEED * (1 - Math.max(above, 0) / EDGE);
		} else if (below < EDGE) {
			scroller.scrollTop += EDGE_SPEED * (1 - Math.max(below, 0) / EDGE);
		}

		// The dragged row's centre, in the same content coordinates as the slots.
		const wanted = this.#pointerY - this.#grab - bounds.top + scroller.scrollTop + this.#height / 2;

		// Clamped to the first and last slot centres, which — rows being of a
		// uniform height — is exactly the span the list occupies. A row dragged
		// past the end has already said everything it can say about where it wants
		// to go, and following the finger out of the list from there is a row
		// floating over unrelated chrome for no further information.
		const first = this.#slots[0] ?? wanted;
		const last = this.#slots.at(-1) ?? wanted;
		const centre = Math.min(Math.max(wanted, first), last);

		const order = this.#options.order();
		const at = order.indexOf(id);

		if (at !== -1) {
			// Walked one slot at a time from where the row is now, which is what
			// makes the threshold symmetric: going down it takes the next slot on
			// passing that slot's centre, and going up it does the mirror image.
			let target = at;

			while (target > 0 && centre < this.#slots[target - 1]) {
				target -= 1;
			}

			while (target < this.#slots.length - 1 && centre > this.#slots[target + 1]) {
				target += 1;
			}

			if (target !== at) {
				this.#options.move(id, target);
			}
		}

		// Measured, not accumulated — see `offset`. `data-drag-id` is on the outer
		// element and this translates the inner one, so what is read here is where
		// layout and `animate:flip` between them have actually put the row, with
		// no term of our own in it and nothing to converge.
		//
		// Read after the reorder above, which is what makes a crossing cost no
		// visible movement: the slot moves a row's height one way, and this moves
		// the row back the other in the same frame.
		//
		// Driven by `centre` rather than by the pointer, so the clamp above is the
		// one that decides where the row is drawn — unclamped the two are the same
		// arithmetic, since `centre` is where the pointer asked the row to be.
		const row = this.#rowFor(id);

		if (row !== null) {
			const top = centre - this.#height / 2 + bounds.top - scroller.scrollTop;

			this.offset = top - row.getBoundingClientRect().top;
		}

		this.#frame = requestAnimationFrame(this.#tick);
	};

	#end(): void {
		if (this.#frame !== undefined) {
			cancelAnimationFrame(this.#frame);
			this.#frame = undefined;
		}

		document.removeEventListener('touchmove', refuse);

		this.#scroller = null;
		this.#slots = [];
		this.liftedId = null;
		this.offset = 0;
	}
}
