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

/**
 * The keys' own height: what the layout viewport has and the visual one does
 * not. Deliberately blind to `top` — see `dockBottom`, which is the number that
 * has to care where the visual viewport currently sits.
 *
 * Clamped at zero. A visual viewport taller than the layout one is not a state
 * to react to.
 */
export function keyboardHeight(pane: Pane): number {
	return Math.max(0, full() - pane.height);
}

/**
 * What a bottom-anchored `position: fixed` panel wants on `bottom` to stand on
 * top of the keys.
 *
 * Not `keyboardHeight`, and the gap between the two is a whole class of bug: a
 * fixed box is placed against the *layout* viewport, so once the browser pans
 * the visual viewport down to lift the focused field clear of the keys — the
 * second event `watchVisiblePane` exists to catch — `top` is how far the two
 * have come apart, and the panel has to give that distance back or it sinks
 * behind the keys by exactly that much.
 *
 * A panned keyboard is still a keyboard, though, which is why this subtraction
 * lives here and not in the height above. Asking `keyboardUp` a question phrased
 * this way answered "no" at the end of every pan, and the ruler, which reads
 * that as the keyboard having gone away, closed itself a second after it opened.
 *
 * Clamped at zero: a negative `bottom` would push the panel off the screen.
 */
export function dockBottom(pane: Pane): number {
	return Math.max(0, full() - pane.top - pane.height);
}

/** Whether the pane leaves enough of the layout viewport covered to be a keyboard. */
export function keyboardUp(pane: Pane): boolean {
	return keyboardHeight(pane) > KEYBOARD_MIN;
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
