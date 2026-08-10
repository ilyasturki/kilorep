import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Pane } from './keyboard';
import { dockBottom, keyboardHeight, keyboardUp } from './keyboard';

/** A phone's layout viewport with nothing over it. */
const LAYOUT = 800;

/** Tall enough to be unmistakably a keyboard and not browser chrome. */
const KEYS = 320;

const WIDTH = 360;

/** The web's shape: the layout viewport stands still and the keys cover it. */
function covered(top: number, height: number): Pane {
	return { top, height, layout: LAYOUT, ground: LAYOUT };
}

describe('visible pane geometry', () => {
	it('reads no keyboard when the visual viewport fills the layout one', () => {
		const pane = covered(0, LAYOUT);

		expect(keyboardUp(pane)).toBe(false);
		expect(keyboardHeight(pane)).toBe(0);
		expect(dockBottom(pane)).toBe(0);
	});

	it('reads the keys the moment they take the bottom of the screen', () => {
		const pane = covered(0, LAYOUT - KEYS);

		expect(keyboardUp(pane)).toBe(true);
		expect(keyboardHeight(pane)).toBe(KEYS);
		expect(dockBottom(pane)).toBe(KEYS);
	});

	/* The regression: the browser lifts the focused field clear of the keys by
	   panning the visual viewport rather than scrolling a page that has nowhere
	   left to go. Nothing about the keyboard changed, so nothing here may say it
	   went away — a panel that dismisses itself on a keyboard going down was
	   closing a second after it opened, which is the whole reason these two
	   numbers are no longer one function. */
	it('keeps reading the keys while the visual viewport is panned under them', () => {
		for (const top of [1, KEYS / 2, KEYS]) {
			const pane = covered(top, LAYOUT - KEYS);

			expect(keyboardUp(pane)).toBe(true);
			expect(keyboardHeight(pane)).toBe(KEYS);
			expect(dockBottom(pane)).toBe(KEYS - top);
		}
	});

	/* A URL bar sliding away is the other thing that changes this ratio, and the
	   threshold exists to sit above it. */
	it('does not take browser chrome for a keyboard', () => {
		const pane = covered(0, LAYOUT - 56);

		expect(keyboardUp(pane)).toBe(false);
		expect(keyboardHeight(pane)).toBe(56);
	});

	/* The shell's shape, and the bug this file used to assert: Capacitor pads the
	   WebView out of the way of the IME, so both viewports end at the keys and
	   there is nothing left over to measure them by. The keys are still there —
	   only the ground remembers how much screen there was before them. Nothing to
	   dock against, though, since the fixed box now ends where they begin. */
	it('reads the keys in a WebView the shell shrank to fit above them', () => {
		const pane = { top: 0, height: LAYOUT - KEYS, layout: LAYOUT - KEYS, ground: LAYOUT };

		expect(keyboardUp(pane)).toBe(true);
		expect(keyboardHeight(pane)).toBe(KEYS);
		expect(dockBottom(pane)).toBe(0);
	});

	it('never returns a negative inset for a pane taller than the ground', () => {
		const pane = { top: 0, height: LAYOUT + 40, layout: LAYOUT + 40, ground: LAYOUT };

		expect(keyboardHeight(pane)).toBe(0);
		expect(dockBottom(pane)).toBe(0);
	});
});

function screen(width: number, height: number): void {
	for (const [key, value] of [
		['innerWidth', width],
		['innerHeight', height]
	] as const) {
		Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
	}
}

function port(offsetTop: number, height: number): void {
	Object.defineProperty(globalThis, 'visualViewport', {
		value: { offsetTop, height },
		configurable: true,
		writable: true
	});
}

afterEach(() => {
	for (const key of ['innerWidth', 'innerHeight', 'visualViewport']) {
		Reflect.deleteProperty(globalThis, key);
	}
});

/* `visiblePane` carries the one piece of state in this module — the resting
   height — so each of these runs against a freshly imported copy of it rather
   than inheriting whatever the test before left standing. */
describe('the layout viewport at rest', () => {
	/* The APK's arrival order, which is what closed the ruler. Chromium takes the
	   IME out of the visual viewport as it animates in; a frame or two later
	   Capacitor's inset padding lands and the WebView itself shrinks to match.
	   Every step of that is a keyboard being up. */
	it('holds the keys through the shell resizing the WebView under them', async () => {
		vi.resetModules();
		const keys = await import('./keyboard');

		screen(WIDTH, LAYOUT);
		port(0, LAYOUT);
		expect(keys.keyboardUp(keys.visiblePane())).toBe(false);

		port(0, LAYOUT - KEYS);
		expect(keys.keyboardUp(keys.visiblePane())).toBe(true);

		screen(WIDTH, LAYOUT - KEYS);
		expect(keys.keyboardUp(keys.visiblePane())).toBe(true);

		screen(WIDTH, LAYOUT);
		port(0, LAYOUT);
		expect(keys.keyboardUp(keys.visiblePane())).toBe(false);
	});

	it('reports the shell pane as ending at the keys, with nothing to dock over', async () => {
		vi.resetModules();
		const keys = await import('./keyboard');

		screen(WIDTH, LAYOUT);
		port(0, LAYOUT);
		keys.visiblePane();

		screen(WIDTH, LAYOUT - KEYS);
		port(0, LAYOUT - KEYS);

		expect(keys.keyboardHeight(keys.visiblePane())).toBe(KEYS);
		expect(keys.dockBottom(keys.visiblePane())).toBe(0);
	});

	/* A rotation is a shorter screen, not a keyboard, and the width is what says
	   so. Without this the ground stays at the portrait height and every panel
	   spends landscape believing the keys are up. */
	it('takes a rotation for new ground rather than a keyboard that never leaves', async () => {
		vi.resetModules();
		const keys = await import('./keyboard');

		screen(WIDTH, LAYOUT);
		port(0, LAYOUT);
		expect(keys.keyboardUp(keys.visiblePane())).toBe(false);

		screen(LAYOUT, WIDTH);
		port(0, WIDTH);
		expect(keys.keyboardUp(keys.visiblePane())).toBe(false);
	});

	/* No `visualViewport` at all — every browser this app supports has one, so
	   this is the shape of a fallback rather than a platform. */
	it('falls back to the layout viewport when there is no visual one', async () => {
		vi.resetModules();
		const keys = await import('./keyboard');

		screen(WIDTH, LAYOUT);

		expect(keys.visiblePane()).toEqual({ top: 0, height: LAYOUT, layout: LAYOUT, ground: LAYOUT });
		expect(keys.keyboardUp(keys.visiblePane())).toBe(false);
	});
});
