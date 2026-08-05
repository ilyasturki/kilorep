/**
 * The strip of screen the OS keyboard has not taken, in the coordinates a
 * `position: fixed` element is laid out in.
 *
 * A fixed box is positioned against the *layout* viewport, which on Android does
 * not shrink when the keyboard rises — `app.html` sets no `interactive-widget`,
 * so the default `resizes-visual` is in force and `bottom: 0` lands underneath
 * the keys. The visual viewport is the part still showing, and `offsetTop` plus
 * `height` describe exactly where it sits inside the layout one. Writing those
 * two onto a fixed panel is what docks it on the keyboard.
 *
 * `interactive-widget=resizes-content` would make `bottom: 0` correct by itself
 * and is deliberately not used: it changes how the keyboard behaves on every
 * screen in the app, and iOS's WebView ignores it, so it would buy one platform
 * a shortcut and leave the other on this path anyway.
 *
 * The iOS shell needs none of this and gets it for free — Capacitor's keyboard
 * resizes the WebView itself, so the layout viewport already ends at the keys,
 * `offsetTop` is 0 and `height` is the whole of it.
 */
export type Pane = { top: number; height: number };

/**
 * A keyboard is up when the layout viewport has more than this much of itself
 * hidden. Not a measurement of any keyboard: a threshold well above the browser
 * chrome that comes and goes on a scroll and well below the shortest keyboard
 * on either platform.
 */
const KEYBOARD_MIN = 120;

function view(): VisualViewport | null {
	return globalThis.visualViewport ?? null;
}

/** The layout viewport's own height — what a fixed box spans when unaided. */
function full(): number {
	return globalThis.innerHeight ?? 0;
}

export function visiblePane(): Pane {
	const port = view();

	if (port === null) {
		return { top: 0, height: full() };
	}

	return { top: port.offsetTop, height: port.height };
}

/** Whether the pane leaves enough of the layout viewport covered to be a keyboard. */
export function keyboardUp(pane: Pane): boolean {
	return full() - pane.top - pane.height > KEYBOARD_MIN;
}

/**
 * Both events, not just `resize`: the keyboard's arrival resizes the visual
 * viewport, and the browser's own scroll-the-focused-input-into-view moves it
 * afterwards without resizing anything. A panel that listened to one of the two
 * sat right until the page settled underneath it.
 */
export function watchVisiblePane(onchange: (pane: Pane) => void): () => void {
	const port = view();

	if (port === null) {
		return () => {
			// No `visualViewport`: nothing was listening, so nothing to unlisten.
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
