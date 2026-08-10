import { afterEach, describe, expect, it } from 'vitest';

import { dockBottom, keyboardHeight, keyboardUp } from './keyboard';

/** A phone's layout viewport, which the keyboard never resizes on Android. */
const LAYOUT = 800;

/** Tall enough to be unmistakably a keyboard and not browser chrome. */
const KEYS = 320;

/* Node has no `innerHeight`, so the helpers read 0 unless one is planted here. */
function layout(height: number): void {
	Object.defineProperty(globalThis, 'innerHeight', {
		value: height,
		configurable: true,
		writable: true
	});
}

afterEach(() => {
	Reflect.deleteProperty(globalThis, 'innerHeight');
});

describe('visible pane geometry', () => {
	it('reads no keyboard when the visual viewport fills the layout one', () => {
		layout(LAYOUT);

		const pane = { top: 0, height: LAYOUT };

		expect(keyboardUp(pane)).toBe(false);
		expect(keyboardHeight(pane)).toBe(0);
		expect(dockBottom(pane)).toBe(0);
	});

	it('reads the keys the moment they take the bottom of the screen', () => {
		layout(LAYOUT);

		const pane = { top: 0, height: LAYOUT - KEYS };

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
		layout(LAYOUT);

		for (const top of [1, KEYS / 2, KEYS]) {
			const pane = { top, height: LAYOUT - KEYS };

			expect(keyboardUp(pane)).toBe(true);
			expect(keyboardHeight(pane)).toBe(KEYS);
			expect(dockBottom(pane)).toBe(KEYS - top);
		}
	});

	/* A URL bar sliding away is the other thing that changes this ratio, and the
	   threshold exists to sit above it. */
	it('does not take browser chrome for a keyboard', () => {
		layout(LAYOUT);

		const pane = { top: 0, height: LAYOUT - 56 };

		expect(keyboardUp(pane)).toBe(false);
		expect(keyboardHeight(pane)).toBe(56);
	});

	/* iOS, where Capacitor resizes the WebView itself: the layout viewport already
	   ends at the keys, so there is nothing hidden and nothing to dock against. */
	it('reads a WebView that was resized for the keys as having none', () => {
		layout(LAYOUT - KEYS);

		const pane = { top: 0, height: LAYOUT - KEYS };

		expect(keyboardUp(pane)).toBe(false);
		expect(dockBottom(pane)).toBe(0);
	});

	it('never returns a negative inset for a visual viewport taller than the layout', () => {
		layout(LAYOUT);

		const pane = { top: 0, height: LAYOUT + 40 };

		expect(keyboardHeight(pane)).toBe(0);
		expect(dockBottom(pane)).toBe(0);
	});
});
