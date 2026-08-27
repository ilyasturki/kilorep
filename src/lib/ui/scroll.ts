import { easeMedium, mediumMs } from '$lib/ui/motion';

export function scrollParent(node: HTMLElement): HTMLElement {
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

function viewport(scroller: HTMLElement): { top: number; bottom: number } {
	return scroller === document.scrollingElement
		? { top: 0, bottom: window.innerHeight }
		: scroller.getBoundingClientRect();
}

// A computed scroll-margin is always an absolute px length.
function px(length: string): number {
	return Number(length.replace('px', '')) || 0;
}

function margins(node: HTMLElement): { top: number; bottom: number } {
	const style = getComputedStyle(node);

	return { top: px(style.scrollMarginTop), bottom: px(style.scrollMarginBottom) };
}

// Margins included, and they have to be: `revealNearest` asks this before it scrolls, so a
// box this calls visible is a box nothing will move. The live tray stands *over* its list and
// the rows say so through `scroll-margin-bottom` — read without it, a row underneath the tray
// reads as plainly visible, and the set the lifter just advanced to is never brought out.
// Same criterion `shortfall` scrolls by, which is what makes the pair agree.
export function fullyVisible(node: HTMLElement): boolean {
	const bounds = viewport(scrollParent(node));
	const rect = node.getBoundingClientRect();
	const margin = margins(node);

	return rect.top - margin.top >= bounds.top && rect.bottom + margin.bottom <= bounds.bottom;
}

let gliding: number | undefined;

let arriving = false;

export function instantly(body: () => void): void {
	arriving = true;

	try {
		body();
	} finally {
		arriving = false;
	}
}

// `scrollTop` is not animatable; a frame loop is the only way to scroll on a named easing.
function glide(scroller: HTMLElement, delta: number): void {
	if (gliding !== undefined) {
		cancelAnimationFrame(gliding);
		gliding = undefined;
	}

	if (delta === 0) {
		return;
	}

	const ms = arriving ? 0 : mediumMs();
	const from = scroller.scrollTop;
	const to = from + delta;

	if (ms === 0) {
		scroller.scrollTop = to;

		return;
	}

	const start = performance.now();

	function frame(now: number): void {
		const t = Math.min(1, (now - start) / ms);

		scroller.scrollTop = from + delta * easeMedium(t);

		if (t < 1) {
			gliding = requestAnimationFrame(frame);

			return;
		}

		// A still-growing scroller clamps `scrollTop`; write the target once more after settling.
		gliding = requestAnimationFrame(() => {
			gliding = undefined;
			scroller.scrollTop = to;
		});
	}

	gliding = requestAnimationFrame(frame);
}

function shortfall(node: HTMLElement, block: 'start' | 'nearest'): number {
	const bounds = viewport(scrollParent(node));
	const rect = node.getBoundingClientRect();
	const margin = margins(node);

	const top = rect.top - margin.top;
	const bottom = rect.bottom + margin.bottom;

	if (block === 'start') {
		return top - bounds.top;
	}

	if (top < bounds.top) {
		return top - bounds.top;
	}

	if (bottom > bounds.bottom) {
		return bottom - bounds.bottom;
	}

	return 0;
}

function land(node: HTMLElement, block: 'start' | 'nearest'): void {
	glide(scrollParent(node), shortfall(node, block));
}

export function revealNearest(node: HTMLElement): void {
	if (fullyVisible(node)) {
		return;
	}

	land(node, 'nearest');
}

export function revealStart(node: HTMLElement): void {
	land(node, 'start');
}

export function revealSpan(from: HTMLElement, to: HTMLElement): void {
	const scroller = scrollParent(to);
	const bounds = viewport(scroller);

	const top = from.getBoundingClientRect().top - margins(from).top;
	const bottom = to.getBoundingClientRect().bottom + margins(to).bottom;

	if (bottom - top > bounds.bottom - bounds.top) {
		revealNearest(to);

		return;
	}

	if (top >= bounds.top && bottom <= bounds.bottom) {
		return;
	}

	glide(scroller, top < bounds.top ? top - bounds.top : bottom - bounds.bottom);
}
