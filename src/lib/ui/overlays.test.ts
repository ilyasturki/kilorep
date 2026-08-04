import { describe, expect, it } from 'vitest';

import { closeTopOverlay, hasOpenOverlay, registerOverlay } from './overlays';

describe('overlay registry', () => {
	it('reports nothing to close when nothing is open', () => {
		expect(hasOpenOverlay()).toBe(false);
		expect(closeTopOverlay()).toBe(false);
	});

	it('unregisters an overlay that closed on its own', () => {
		const unregister = registerOverlay(() => {
			throw new Error('closed overlays must not be called');
		});

		unregister();

		expect(hasOpenOverlay()).toBe(false);
		expect(closeTopOverlay()).toBe(false);
	});

	it('closes the most recent first, and survives a double unregister', () => {
		const closed: string[] = [];
		registerOverlay(() => {
			closed.push('sheet');
		});
		const unregisterConfirm = registerOverlay(() => {
			closed.push('confirm');
		});

		expect(closeTopOverlay()).toBe(true);
		unregisterConfirm();
		unregisterConfirm();

		expect(hasOpenOverlay()).toBe(true);
		expect(closeTopOverlay()).toBe(true);
		expect(closed).toEqual(['confirm', 'sheet']);
		expect(hasOpenOverlay()).toBe(false);
	});
});
