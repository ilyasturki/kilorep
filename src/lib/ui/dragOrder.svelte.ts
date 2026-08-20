import { tapHold } from '$lib/ui/feedback';
import { scrollParent } from '$lib/ui/scroll';

export type DragOrderOptions = {
	order: () => string[];
	move: (id: string, index: number) => boolean;
	lift?: (id: string) => void;
	drop?: (id: string) => void;
	covered?: () => number;
};

const HOLD_LIFT = 500;

const MOUSE_SLOP = 4;

const TOUCH_SLOP = 12;

const HYSTERESIS = 8;

const IN_HAND = 'drag-in-hand';

function refuse(event: TouchEvent): void {
	event.preventDefault();
}

const EDGE_BAND = 48;
const EDGE_SPEED = 14;

const GIVE = 24;

const SETTLE_MS = 200;

export const SETTLE = `transform ${SETTLE_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;

export class DragOrder {
	public root: HTMLElement | null = $state(null);

	public liftedId: string | null = $state(null);

	public settlingId: string | null = $state(null);

	public offset: number = $state(0);

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

	#pending: { event: PointerEvent; id: string; x: number; y: number; mouse: boolean } | null = null;

	public constructor(options: DragOrderOptions) {
		this.#options = options;

		$effect(() => () => {
			this.#end();
		});
	}

	public isLifted(id: string): boolean {
		return this.liftedId === id;
	}

	public handleDown(event: PointerEvent, id: string): void {
		if (this.liftedId !== null) {
			return;
		}

		this.#arm(event);
		this.#lift(event, id);
	}

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

	public up(event: PointerEvent): void {
		if (event.pointerId === this.#pointerId) {
			this.#putDown();
		}
	}

	public move(event: PointerEvent): void {
		if (event.pointerId !== this.#pointerId) {
			return;
		}

		this.#pointerY = event.clientY;

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

	public cancel(): void {
		if (this.liftedId !== null) {
			this.#options.move(this.liftedId, this.#origin);
		}

		this.#putDown();
	}

	#putDown(): void {
		const dropped = this.liftedId;

		clearTimeout(this.#hold);
		this.#end();

		if (dropped !== null) {
			this.#options.drop?.(dropped);
		}
	}

	// Refuses the click outright rather than only reporting it, the way `press` and the
	// swipe rail already do. A tap that did nothing but end a drag is not a tap, and one
	// left to bubble reaches the document listener that answers taps with a click sound.
	public swallowClick(event: MouseEvent): boolean {
		if (!this.#lifted || event.detail === 0) {
			return false;
		}

		this.#lifted = false;
		event.preventDefault();
		event.stopImmediatePropagation();

		return true;
	}

	#arm(event: PointerEvent): void {
		clearTimeout(this.#hold);
		this.#lifted = false;
		this.#pointerId = event.pointerId;
		this.#pointerY = event.clientY;
	}

	readonly #docMove = (event: PointerEvent): void => {
		this.move(event);
	};

	readonly #docUp = (event: PointerEvent): void => {
		this.up(event);
	};

	#rowFor(id: string): HTMLElement | null {
		return this.root?.querySelector(`[data-drag-id="${CSS.escape(id)}"]`) ?? null;
	}

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

		const spans = this.#options.order().flatMap((entryId) => {
			const rects = [
				...root.querySelectorAll<HTMLElement>(`[data-drag-id="${CSS.escape(entryId)}"]`)
			].map((part) => part.getBoundingClientRect());

			if (rects.length === 0) {
				return [];
			}

			return [
				{
					entryId,
					top: Math.min(...rects.map((rect) => rect.top)),
					bottom: Math.max(...rects.map((rect) => rect.bottom))
				}
			];
		});

		this.#heights = new Map(spans.map((span) => [span.entryId, span.bottom - span.top]));

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

		clearTimeout(this.#settle);
		this.settlingId = null;

		tapHold();

		document.documentElement.classList.add(IN_HAND);

		this.#options.lift?.(id);

		document.addEventListener('pointermove', this.#docMove);
		document.addEventListener('pointerup', this.#docUp);
		document.addEventListener('pointercancel', this.#docUp);

		// Against `target`, not `currentTarget`: the long-press path reads this event
		// half a second after dispatch, by which time `currentTarget` is null.
		try {
			if (event.target instanceof Element) {
				event.target.setPointerCapture(this.#pointerId);
			}
		} catch {
			// `setPointerCapture` throws on a pointer that is no longer active.
		}

		// Non-passive so it can refuse the pan, and registered only now: after 500ms of a
		// stationary finger the browser has not yet committed to a scroll.
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

		const above = this.#pointerY - bounds.top;
		const below = bounds.bottom - (this.#options.covered?.() ?? 0) - this.#pointerY;

		if (above < EDGE_BAND) {
			scroller.scrollTop -= EDGE_SPEED * (1 - Math.max(above, 0) / EDGE_BAND);
		} else if (below < EDGE_BAND) {
			scroller.scrollTop += EDGE_SPEED * (1 - Math.max(below, 0) / EDGE_BAND);
		}

		const wantedCentre =
			this.#pointerY - this.#grab - bounds.top + scroller.scrollTop + this.#height / 2;

		const order = this.#options.order();
		const total =
			order.reduce((sum, entryId) => sum + (this.#heights.get(entryId) ?? this.#height), 0) +
			this.#gap * Math.max(order.length - 1, 0);

		const min = this.#listTop + this.#height / 2;
		const max = this.#listTop + total - this.#height / 2;
		const centre = Math.min(Math.max(wantedCentre, min), max);

		const at = order.indexOf(id);

		if (at !== -1) {
			let target = at;

			if (centre <= min) {
				target = 0;
			} else if (centre >= max) {
				target = order.length - 1;
			} else {
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

		const overrun = wantedCentre - centre;
		const give = (GIVE * overrun) / (Math.abs(overrun) + GIVE * 2);

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
