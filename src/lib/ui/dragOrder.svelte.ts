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
 * hold that opens something rather than a hold that accelerates. Under a
 * mouse the row also lifts on the first few pixels of travel with the button
 * down: a pressed button being dragged is the drag being asked for, and half
 * a second of stillness is a touch idiom no desktop list observes. A touch
 * that travels does the opposite and cancels the hold — a finger that moved
 * was scrolling, and a lift landing on it would yank the row to wherever the
 * scroll had got to.
 *
 * The list reorders live, on every crossing, so the drop has nothing left to
 * do. What that costs is a cancel path: the index the row started at is
 * remembered, and Escape puts it back.
 *
 * Heights are measured once at lift — per entry, so a superset's two rows
 * weigh as one — and the slot geometry is computed from them against the live
 * order on every frame. Positions are never read back off the DOM mid-drag:
 * `animate:flip` is usually still sliding rows toward the layout the last move
 * decided, and thresholds built on rects caught mid-slide would chase their own
 * consequences. The computed slots are that slide's destination, which is the
 * one worth measuring against. Travel is bounded to the list either way: past
 * the end the row gives a damped few pixels and no more, which is the edge
 * telling the finger it is an edge.
 */

import { tapLift } from '$lib/ui/haptics';
import { scrollParent } from '$lib/ui/scroll';

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
	/**
	 * The row is back on the ground — released, or snapped home by Escape.
	 *
	 * Fired after the reorder is final, which `lift` is too early for: a screen
	 * that wants to show where the row landed can only do so once it has landed.
	 * Not fired by unmount teardown, where there is no list left to show.
	 */
	drop?: (id: string) => void;
	/**
	 * Chrome laid over the scroller's bottom edge, in px — the template
	 * screen's sticky Start bar. The auto-scroll band is measured from the
	 * scroller's rect, and the strip behind an overlay is one the finger can
	 * never reach: without the allowance, a drag toward the bar stalls at its
	 * top instead of scrolling. Read every frame, so a bar that resizes is
	 * simply followed.
	 */
	covered?: () => number;
};

/** Matches `SetRow`'s long-press: a hold that opens something, not one that accelerates. */
const HOLD_LIFT = 500;

/**
 * Travel that promotes a pressed mouse button to a lift, in px. Small,
 * because with the button down there is nothing else the movement could mean
 * — a click that wanders less than this still lands as a click.
 */
const MOUSE_SLOP = 4;

/**
 * Travel that cancels a touch hold, in px. Looser than the mouse's, because
 * a finger holding still isn't: a few pixels of tremor are the hold, and
 * only past this is it a scroll that should never lift.
 */
const TOUCH_SLOP = 12;

/**
 * How far past a resident's centre the dragged entry's leading edge must
 * reach before the two trade places, in px. The trade itself leaves the
 * resident's centre only a gap short of where the edge crossed it, and a
 * seam that thin would trade the rows straight back on tremor.
 */
const HYSTERESIS = 8;

/**
 * Stamped on `<html>` for the length of a lift. The first crossing clears
 * pointer capture and hit-testing resumes over whatever the row is passing,
 * so without it the cursor flickers through text-beams and pointers mid-drag
 * — and the selection rule keeps a mouse that lifted mid-sentence from
 * painting a selection under the travelling row. The rule lives in app.css.
 */
const IN_HAND = 'drag-in-hand';

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
 * How far a row will follow the finger past the end of the list, in px. The
 * travel is a diminishing fraction of the overrun — half of it at first,
 * flattening toward this ceiling — so the stop reads as elastic rather than
 * as a wall the row was nailed to.
 */
const GIVE = 24;

/** How long the put-down takes. `SETTLE` below and the settle window share it. */
const SETTLE_MS = 200;

/**
 * The put-down, applied by the consumer as an inline `transition` on the same
 * element its drag transform lives on: quick, with a hair of overshoot so the
 * landing reads as a spring rather than a stop. Only while `settlingId` says
 * so — left on permanently it would lag the very transform it animates, one
 * frame of transition chasing every frame of drag.
 */
export const SETTLE = `transform ${SETTLE_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;

export class DragOrder {
	/** The list wrapper. Rows inside it are found by their `data-drag-id`. */
	public root: HTMLElement | null = $state(null);

	/** The row in hand, or null. Drives the lifted styling. */
	public liftedId: string | null = $state(null);

	/**
	 * The row just put down, until its landing finishes. What the consumer
	 * keys the `SETTLE` transition on, and cleared on a schedule slightly
	 * longer than the transition so the spring is never cut off mid-flight.
	 */
	public settlingId: string | null = $state(null);

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
	#heights = new Map<string, number>();
	#gap = 0;
	#listTop = 0;
	#height = 0;
	#grab = 0;
	#pointerY = 0;
	#pointerId = -1;
	#origin = 0;
	#frame: number | undefined;
	#hold: ReturnType<typeof setTimeout> | undefined;
	#settle: ReturnType<typeof setTimeout> | undefined;
	#lifted = false;

	/**
	 * A press on the row body that has not become anything yet — the window
	 * where movement decides between a lift (mouse), a cancelled hold (touch)
	 * and, by staying still, the hold itself.
	 */
	#pending: { event: PointerEvent; id: string; x: number; y: number; mouse: boolean } | null = null;

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
	 *
	 * A second finger arriving while a row is already in hand is noise, not a
	 * gesture: the drag belongs to the pointer that lifted it, and here — like
	 * in `rowDown`, `move` and `up` — every other pointer is ignored.
	 */
	public handleDown(event: PointerEvent, id: string): void {
		if (this.liftedId !== null) {
			return;
		}

		this.#arm(event);
		this.#lift(event, id);
	}

	/**
	 * A press on the row, which lifts if it is still held at 500ms — or, under
	 * a mouse, the moment it travels `MOUSE_SLOP`. See `move` for the split.
	 */
	public rowDown(event: PointerEvent, id: string): void {
		if (this.liftedId !== null) {
			return;
		}

		this.#arm(event);
		this.#pending = {
			event,
			id,
			x: event.clientX,
			y: event.clientY,
			mouse: event.pointerType === 'mouse'
		};
		this.#hold = setTimeout(() => {
			this.#pending = null;
			this.#lift(event, id);
		}, HOLD_LIFT);
	}

	/**
	 * Every way the press ends: released, dragged off, or taken by the browser.
	 * Only the pointer that started the gesture may end it — a second finger
	 * tapped against the list mid-drag must not put the row down.
	 */
	public up(event: PointerEvent): void {
		if (event.pointerId !== this.#pointerId) {
			return;
		}

		clearTimeout(this.#hold);

		const dropped = this.liftedId;

		this.#end();

		if (dropped !== null) {
			this.#options.drop?.(dropped);
		}
	}

	public move(event: PointerEvent): void {
		if (event.pointerId !== this.#pointerId) {
			return;
		}

		this.#pointerY = event.clientY;

		// The pending press resolves on travel, and which way depends on what
		// the pointer could have meant: a mouse with the button down has nothing
		// to say but "drag", so it lifts; a finger that moved was scrolling, so
		// the hold is cancelled before it can lift a row out from under a pan.
		const pending = this.#pending;

		if (pending === null || this.liftedId !== null) {
			return;
		}

		const travel = Math.hypot(event.clientX - pending.x, event.clientY - pending.y);

		if (travel > (pending.mouse ? MOUSE_SLOP : TOUCH_SLOP)) {
			this.#pending = null;
			clearTimeout(this.#hold);

			if (pending.mouse) {
				this.#lift(pending.event, pending.id);
			}
		}
	}

	/**
	 * Escape puts the row back where it was lifted from.
	 *
	 * The only thing a live reorder costs: with the tree already rewritten on
	 * every crossing, undoing is a move rather than a discarded draft.
	 */
	public cancel(): void {
		const dropped = this.liftedId;

		if (dropped !== null) {
			this.#options.move(dropped, this.#origin);
		}

		clearTimeout(this.#hold);
		this.#end();

		// A cancel is a put-down too — the row went home rather than somewhere
		// new, and home may equally be off screen.
		if (dropped !== null) {
			this.#options.drop?.(dropped);
		}
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

	// Registered on the document for the length of a lift, like `refuse`. The
	// row's own handlers cannot be trusted with a live drag: every crossing
	// relocates the row's DOM node, relocation clears pointer capture, and from
	// then on events go by hit-testing — a release just past the drawn row
	// would land on unrelated chrome and leave the row lifted with nothing
	// holding it. The document hears everything whoever the browser aims at;
	// `move` and `up` filter by pointer id, so nothing else gets through.
	readonly #docMove = (event: PointerEvent): void => {
		this.move(event);
	};

	readonly #docUp = (event: PointerEvent): void => {
		this.up(event);
	};

	#rowFor(id: string): HTMLElement | null {
		return this.root?.querySelector(`[data-drag-id="${CSS.escape(id)}"]`) ?? null;
	}

	/**
	 * The centres each entry would settle at were the list in this order, in
	 * the scroller's content coordinates — the layout flip is heading toward,
	 * not the one mid-slide on screen. Built from the heights measured at lift,
	 * walked top to bottom the way flex will lay them.
	 */
	#centres(order: string[]): number[] {
		let top = this.#listTop;

		return order.map((id) => {
			const height = this.#heights.get(id) ?? this.#height;
			const centre = top + height / 2;

			top += height + this.#gap;

			return centre;
		});
	}

	#lift(event: PointerEvent, id: string): void {
		const root = this.root;
		const row = this.#rowFor(id);

		if (root === null || row === null) {
			return;
		}

		const scroller = scrollParent(root);
		const bounds = scroller.getBoundingClientRect();

		// One span per entry, not per row: a superset is one entry rendering as
		// two rows that travel as one, so its rects merge — inner gap included —
		// and the slot arithmetic never sees more slots than the order has ids.
		const spans = this.#options.order().flatMap((entryId) => {
			const parts = [
				...root.querySelectorAll<HTMLElement>(`[data-drag-id="${CSS.escape(entryId)}"]`)
			];

			if (parts.length === 0) {
				return [];
			}

			const rects = parts.map((part) => part.getBoundingClientRect());

			return [
				{
					entryId,
					top: Math.min(...rects.map((rect) => rect.top)),
					bottom: Math.max(...rects.map((rect) => rect.bottom))
				}
			];
		});

		this.#heights = new Map(spans.map((span) => [span.entryId, span.bottom - span.top]));

		// The flex gap, read off the first seam — uniform per list, so one seam
		// is every seam. And where the list starts, in content coordinates: a
		// fixed point however the rows trade places below it, which is what lets
		// the slot layout be computed instead of chased.
		this.#gap = spans.length > 1 ? spans[1].top - spans[0].bottom : 0;
		this.#listTop = (spans[0]?.top ?? bounds.top) - bounds.top + scroller.scrollTop;

		const box = row.getBoundingClientRect();

		this.#scroller = scroller;
		this.#height = this.#heights.get(id) ?? box.height;
		this.#grab = this.#pointerY - box.top;
		this.#origin = this.#options.order().indexOf(id);
		this.#lifted = true;
		this.liftedId = id;
		this.offset = 0;

		// A row lifted again before its landing finished must not drag through
		// the settle transition — one frame of spring chasing every frame of
		// finger.
		clearTimeout(this.#settle);
		this.settlingId = null;

		// A hold has nothing on screen to say it registered until the row moves,
		// and by then the user has already started guessing.
		tapLift();

		document.documentElement.classList.add(IN_HAND);

		// After the lift is fully built, so a handler that reaches back into this
		// list — the workout screen jumps to the exercise it just picked up — finds
		// a drag already in hand rather than one half-assembled.
		this.#options.lift?.(id);

		// The document listeners are what actually carry the drag — see `#docMove`
		// for why the row's own handlers stop being trustworthy the moment the
		// first crossing relocates its node.
		document.addEventListener('pointermove', this.#docMove);
		document.addEventListener('pointerup', this.#docUp);
		document.addEventListener('pointercancel', this.#docUp);

		// The capture is now only a courtesy — it keeps hover states and text
		// selection from lighting up under a row being dragged across them, and
		// the first crossing clears it anyway. It is taken against `target` and
		// not `currentTarget`, because the long-press path reads this event half
		// a second after dispatch, by which time the browser has already nulled
		// `currentTarget`.
		//
		// Not fatal if it is refused. `setPointerCapture` throws when the pointer
		// is no longer active, and a lift is already half-built by this line — an
		// exception here would leave a row marked lifted with nothing driving it
		// and no way to put it down.
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
		// the fast ones and a pointer parked just inside the band crawls. The
		// floor backs off by whatever `covered` says is laid over it — a band
		// behind the Start bar is a band the finger can never reach.
		const above = this.#pointerY - bounds.top;
		const below = bounds.bottom - (this.#options.covered?.() ?? 0) - this.#pointerY;

		if (above < EDGE) {
			scroller.scrollTop -= EDGE_SPEED * (1 - Math.max(above, 0) / EDGE);
		} else if (below < EDGE) {
			scroller.scrollTop += EDGE_SPEED * (1 - Math.max(below, 0) / EDGE);
		}

		// The dragged entry's centre, in the same content coordinates as the slots.
		const wanted = this.#pointerY - this.#grab - bounds.top + scroller.scrollTop + this.#height / 2;

		const order = this.#options.order();
		const total =
			order.reduce((sum, entryId) => sum + (this.#heights.get(entryId) ?? this.#height), 0) +
			this.#gap * Math.max(order.length - 1, 0);

		// Clamped to where *this* entry's centre would sit in the first and last
		// slots — not to the resident rows' centres, which a taller entry's
		// clamped centre could never cross. A row dragged past the end has
		// already said everything it can say about where it wants to go, and
		// following the finger out of the list from there is a row floating over
		// unrelated chrome for no further information.
		const min = this.#listTop + this.#height / 2;
		const max = this.#listTop + total - this.#height / 2;
		const centre = Math.min(Math.max(wanted, min), max);

		const at = order.indexOf(id);

		if (at !== -1) {
			let target = at;

			if (centre <= min) {
				// At the stops the walk below can go quiet — a short resident row
				// has a centre the clamp keeps a taller entry from ever crossing —
				// but a finger pushed all the way to the clamp has said "first" or
				// "last" as clearly as it is possible to say it.
				target = 0;
			} else if (centre >= max) {
				target = order.length - 1;
			} else {
				// Walked one slot at a time against a simulated order, the centres
				// recomputed after every step: with heights varying, each crossing
				// changes the very layout the next threshold is read from.
				//
				// The trigger is the dragged entry's *leading edge* passing the
				// resident's centre — the trade happens once the row covers the
				// neighbour's half. It used to be centre meeting centre, which
				// reads the same on paper and drags a full slot behind the finger
				// in the hand: from rest, a centre has a whole pitch to travel
				// before it reaches the next one, so every first swap arrived a
				// beat late. The trade moves the resident's centre a gap past
				// where the edge crossed it — hysteresis, but only a gap of it,
				// which is what `HYSTERESIS` widens to more than tremor.
				const work = [...order];
				let centres = this.#centres(work);
				const edge = this.#height / 2;

				while (target > 0 && centre - edge <= centres[target - 1] - HYSTERESIS) {
					[work[target - 1], work[target]] = [work[target], work[target - 1]];
					target -= 1;
					centres = this.#centres(work);
				}

				while (target < work.length - 1 && centre + edge >= centres[target + 1] + HYSTERESIS) {
					[work[target + 1], work[target]] = [work[target], work[target + 1]];
					target += 1;
					centres = this.#centres(work);
				}
			}

			if (target !== at) {
				this.#options.move(id, target);
			}
		}

		// Past the clamp the row gives a little instead of nothing: a
		// diminishing fraction of the overrun, half at first and flattening
		// toward `GIVE`. Pull back and it follows back — the elastic is the
		// finger's own motion damped, not an animation.
		const overrun = wanted - centre;
		const give = (GIVE * overrun) / (Math.abs(overrun) + GIVE * 2);

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
			const top = centre + give - this.#height / 2 + bounds.top - scroller.scrollTop;

			this.offset = top - row.getBoundingClientRect().top;
		}

		this.#frame = requestAnimationFrame(this.#tick);
	};

	#end(): void {
		if (this.#frame !== undefined) {
			cancelAnimationFrame(this.#frame);
			this.#frame = undefined;
		}

		this.#pending = null;
		document.documentElement.classList.remove(IN_HAND);
		document.removeEventListener('touchmove', refuse);
		document.removeEventListener('pointermove', this.#docMove);
		document.removeEventListener('pointerup', this.#docUp);
		document.removeEventListener('pointercancel', this.#docUp);

		// The row that was in hand gets its landing: `settlingId` holds it just
		// past the transition's own length, so the spring finishes before the
		// inline transition comes back off.
		if (this.liftedId !== null) {
			this.settlingId = this.liftedId;
			clearTimeout(this.#settle);
			this.#settle = setTimeout(() => {
				this.settlingId = null;
			}, SETTLE_MS + 50);
		}

		this.#scroller = null;
		this.#heights = new Map();
		this.#pointerId = -1;
		this.liftedId = null;
		this.offset = 0;
	}
}
