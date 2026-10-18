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

// The shell shrank the layout itself, so anything docked at its bottom already stands above the keys.
export function shellResized(pane: Pane): boolean {
	return pane.ground - pane.layout > KEYBOARD_MIN;
}

export type SheetDock = { keys: number; pane: number };

// Null in the shell too: mid-animation its visual viewport reads a fraction of the layout it shows.
export function sheetDock(pane: Pane): SheetDock | null {
	if (!keyboardUp(pane) || shellResized(pane)) {
		return null;
	}

	return { keys: dockBottom(pane), pane: pane.height };
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

/**
 * Keeps a bottom sheet above the keyboard: `--sheet-keys` / `--sheet-pane` for app.css to dock
 * it by, and `data-shell-keys` where the shell resized the WebView instead.
 */
export function dockSheet(
	node: HTMLElement,
	onkeys: (up: boolean) => void = () => {
		/* empty */
	}
): () => void {
	const dock = (pane: Pane): void => {
		onkeys(keyboardUp(pane));

		const at = sheetDock(pane);

		if (at === null) {
			node.style.removeProperty('--sheet-keys');
			node.style.removeProperty('--sheet-pane');
		} else {
			node.style.setProperty('--sheet-keys', `${at.keys}px`);
			node.style.setProperty('--sheet-pane', `${at.pane}px`);
		}

		node.toggleAttribute('data-shell-keys', keyboardUp(pane) && shellResized(pane));

		// A settled drag leaves vaul's inline `transition: transform`, which clobbers the
		// stylesheet's `bottom`/`max-height` legs; clearing it hands the rule back.
		node.style.removeProperty('transition');
	};

	dock(visiblePane());

	return watchVisiblePane(dock);
}
