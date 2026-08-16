import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Pane } from './keyboard';
import { dockBottom, keyboardHeight, keyboardUp } from './keyboard';

const LAYOUT = 800;

const KEYS = 320;

const WIDTH = 360;

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

	it('keeps reading the keys while the visual viewport is panned under them', () => {
		for (const top of [1, KEYS / 2, KEYS]) {
			const pane = covered(top, LAYOUT - KEYS);

			expect(keyboardUp(pane)).toBe(true);
			expect(keyboardHeight(pane)).toBe(KEYS);
			expect(dockBottom(pane)).toBe(KEYS - top);
		}
	});

	it('does not take browser chrome for a keyboard', () => {
		const pane = covered(0, LAYOUT - 56);

		expect(keyboardUp(pane)).toBe(false);
		expect(keyboardHeight(pane)).toBe(56);
	});

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

describe('the layout viewport at rest', () => {
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

	it('falls back to the layout viewport when there is no visual one', async () => {
		vi.resetModules();
		const keys = await import('./keyboard');

		screen(WIDTH, LAYOUT);

		expect(keys.visiblePane()).toEqual({ top: 0, height: LAYOUT, layout: LAYOUT, ground: LAYOUT });
		expect(keys.keyboardUp(keys.visiblePane())).toBe(false);
	});
});
