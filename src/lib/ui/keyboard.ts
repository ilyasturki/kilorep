// Web: the layout viewport keeps its height under the keys (`resizes-visual`), so a fixed
// box docks via top/height. Capacitor shell: both viewports shrink, so keys read off `ground`.
export type Pane = {
	top: number;
	height: number;
	layout: number;
	ground: number;
};

// Above any browser chrome that comes and goes on scroll, below the shortest keyboard.
const KEYBOARD_MIN = 120;

function view(): VisualViewport | null {
	return globalThis.visualViewport ?? null;
}

function full(): number {
	return globalThis.innerHeight ?? 0;
}

// A keyboard only ever takes height: the tallest layout height seen at this width is the
// keyboardless one, and a width change (rotation) re-grounds.
let resting = { width: 0, height: 0 };

function ground(layout: number): number {
	const width = globalThis.innerWidth ?? 0;

	if (width !== resting.width || layout > resting.height) {
		resting = { width, height: layout };
	}

	return resting.height;
}

export function visiblePane(): Pane {
	const layout = full();
	const rest = ground(layout);
	const port = view();

	if (port === null) {
		return { top: 0, height: layout, layout, ground: rest };
	}

	return { top: port.offsetTop, height: port.height, layout, ground: rest };
}

export function keyboardHeight(pane: Pane): number {
	return Math.max(0, pane.ground - pane.height);
}

export function dockBottom(pane: Pane): number {
	return Math.max(0, pane.layout - pane.top - pane.height);
}

export function keyboardUp(pane: Pane): boolean {
	return keyboardHeight(pane) > KEYBOARD_MIN;
}

// Keyboard arrival fires `resize`; the browser's own pan to the focused input fires only `scroll`.
export function watchVisiblePane(onchange: (pane: Pane) => void): () => void {
	const port = view();

	if (port === null) {
		return () => {
			/* empty */
		};
	}

	const tell = (): void => {
		onchange(visiblePane());
	};

	port.addEventListener('resize', tell);
	port.addEventListener('scroll', tell);

	return () => {
		port.removeEventListener('resize', tell);
		port.removeEventListener('scroll', tell);
	};
}
