import { describe, expect, it } from 'vitest';

import { closeTopOverlay, hasOpenOverlay, registerOverlay } from './overlays';

describe('overlay registry', () => {
	it('reports nothing to close when nothing is open', () => {
		expect(hasOpenOverlay()).toBe(false);
		expect(closeTopOverlay()).toBe(false);
	});

	it('closes the most recently opened overlay first', () => {
		const closed: string[] = [];
		const unregisterSheet = registerOverlay(() => {
			closed.push('sheet');
		});
		const unregisterConfirm = registerOverlay(() => {
			closed.push('confirm');
		});

		expect(closeTopOverlay()).toBe(true);
		expect(closed).toEqual(['confirm']);

		expect(closeTopOverlay()).toBe(true);
		expect(closed).toEqual(['confirm', 'sheet']);

		expect(hasOpenOverlay()).toBe(false);
		unregisterSheet();
		unregisterConfirm();
	});

	it('unregisters an overlay that closed on its own', () => {
		const unregister = registerOverlay(() => {
			throw new Error('closed overlays must not be called');
		});

		unregister();

		expect(hasOpenOverlay()).toBe(false);
		expect(closeTopOverlay()).toBe(false);
	});

	it('tolerates the double cleanup of a closer that also unregisters', () => {
		const closed: string[] = [];
		const unregisterFirst = registerOverlay(() => {
			closed.push('first');
		});
		const unregisterSecond = registerOverlay(() => {
			closed.push('second');
		});

		// Back press pops `second`, whose effect cleanup then unregisters again.
		closeTopOverlay();
		unregisterSecond();
		unregisterSecond();

		// `first` must still be the top, not collateral of the double cleanup.
		expect(hasOpenOverlay()).toBe(true);
		expect(closeTopOverlay()).toBe(true);
		expect(closed).toEqual(['second', 'first']);
		unregisterFirst();
	});
});
