/**
 * The strip of screen the OS keyboard has not taken, in the coordinates a
 * `position: fixed` element is laid out in.
 *
 * The keys are taken out of the screen two different ways, and carrying four
 * numbers rather than two is what lets one panel sit right under both.
 *
 * On the web, a fixed box is positioned against the *layout* viewport, which on
 * Android does not shrink when the keyboard rises — `app.html` sets no
 * `interactive-widget`, so the default `resizes-visual` is in force and
 * `bottom: 0` lands underneath the keys. The visual viewport is the part still
 * showing, and `offsetTop` plus `height` describe exactly where it sits inside
 * the layout one. Writing those two onto a fixed panel is what docks it on the
 * keyboard.
 *
 * In the shell both viewports shrink together and there is nothing to dock
 * against: Capacitor's `SystemBars` pads the WebView's parent by the IME inset
 * on Android — the edge-to-edge path every device on targetSdk 35+ takes, which
 * is all of them here — and on iOS Capacitor's keyboard resizes the WebView
 * itself. The layout viewport already ends at the keys, `offsetTop` is 0, and
 * `height` is the whole of what is left.
 *
 * Which is why the keys may not be measured as what the layout viewport has and
 * the visual one does not: in the shell that is zero with a keyboard filling
 * half the screen. `ground` is the number that survives both — see below.
 *
 * `interactive-widget=resizes-content` would make `bottom: 0` correct by itself
 * and is deliberately not used: it changes how the keyboard behaves on every
 * screen in the app, and iOS's WebView ignores it, so it would buy one platform
 * a shortcut and leave the other on this path anyway.
 */
export type Pane = {
	/** Where the visual viewport starts inside the layout one. */
	top: number;
	/** How much of the screen is left showing. */
	height: number;
	/** The layout viewport as it stands — what a fixed box spans right now. */
	layout: number;
	/** The layout viewport with no keyboard in it. */
	ground: number;
};

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

/**
 * The layout viewport with no keyboard in it, and the width it was measured at.
 *
 * Neither platform reports the keys, and in the shell the layout viewport is
 * not a fixed number to subtract the visible strip from — the keys come out of
 * that too. So the resting height is remembered instead: the tallest the layout
 * viewport has been at this width. A keyboard only ever takes height and never
 * gives it, so the tallest one seen is the one with no keys in it.
 *
 * Keyed by width, and re-grounded outright when the width changes, because a
 * rotation is the other thing that moves this number — left alone, a portrait
 * height would stand as landscape's ground and every panel would read a
 * permanent keyboard on a screen with none. A keyboard never changes the width,
 * so the two cannot be confused.
 *
 * Browser chrome sliding away can leave the ground a URL bar taller than the
 * layout viewport now is, which overstates the keys by that much and is
 * deliberately not corrected for: the only thing that reads the number is a
 * threshold set well above a URL bar.
 */
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

/**
 * What the keys have taken, whether they took it by covering the viewport or by
 * shrinking it. Measured against the viewport at rest and not the one there is
 * now, which in the shell has already had the keys subtracted from it — asking
 * the question that way answered "no keyboard" to a keyboard filling half the
 * screen, and the ruler, which reads that as the keyboard having gone away,
 * closed itself half a second after it opened.
 *
 * Deliberately blind to `top` — see `dockBottom`, which is the number that has
 * to care where the visual viewport currently sits.
 *
 * Clamped at zero. A visible pane taller than the ground is not a state to
 * react to; it is the frame before the ground catches up with it.
 */
export function keyboardHeight(pane: Pane): number {
	return Math.max(0, pane.ground - pane.height);
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
 * The layout viewport as it stands and never the ground: this is where a fixed
 * box is being laid out right now. In the shell that box already ends at the
 * keys, and the answer is rightly zero.
 *
 * Clamped at zero: a negative `bottom` would push the panel off the screen.
 */
export function dockBottom(pane: Pane): number {
	return Math.max(0, pane.layout - pane.top - pane.height);
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
