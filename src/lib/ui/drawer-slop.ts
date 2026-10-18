import { SLOP } from '$lib/ui/press';

type Handlers = {
	onpointerdown: (event: PointerEvent) => void;
	onpointerup: (event: PointerEvent & { currentTarget: EventTarget & HTMLElement }) => void;
};

// vaul closes on release velocity measured over the whole press, so a quick tap with a thumb's
// roll reads as a flick. These run before vaul's own handlers: a release within the slop puts
// the panel back first, and vaul, finding it unmoved, treats the press as no drag at all.
export function drawerSlop(): Handlers {
	let start: { x: number; y: number } | null = null;

	return {
		onpointerdown(event) {
			start = { x: event.clientX, y: event.clientY };
		},
		onpointerup(event) {
			const still =
				start !== null && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= SLOP;

			start = null;

			if (!still) {
				return;
			}

			const panel = event.currentTarget;

			// Without a transition, or vaul would read the snap back mid-flight as the offset.
			panel.style.setProperty('transition', 'none');
			panel.style.setProperty('transform', 'translate3d(0, 0, 0)');

			requestAnimationFrame(() => {
				panel.style.removeProperty('transition');
			});
		}
	};
}
