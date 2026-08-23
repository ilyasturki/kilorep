import { describe, expect, it } from 'vitest';

import { closeTopOverlay, hasOpenOverlay, registerOverlay, watchOverlays } from './overlays';

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

describe('overlay watchers', () => {
	it('announces an overlay opening and closing, and stops when unwatched', () => {
		const seen: boolean[] = [];
		const unwatch = watchOverlays(() => {
			seen.push(hasOpenOverlay());
		});

		const unregister = registerOverlay(() => {
			/* closed by hand below */
		});

		unregister();
		unwatch();
		registerOverlay(() => {
			/* empty */
		});

		expect(seen).toEqual([true, false]);
		expect(closeTopOverlay()).toBe(true);
	});

	// The half `closeTopOverlay` gets wrong if it announces after running the close: the
	// stack it is asked about must already be the one the close leaves behind.
	it('reports an emptied stack from inside the close it ran', () => {
		const seen: boolean[] = [];
		const unwatch = watchOverlays(() => {
			seen.push(hasOpenOverlay());
		});

		registerOverlay(() => {
			seen.push(hasOpenOverlay());
		});

		closeTopOverlay();
		unwatch();

		expect(seen).toEqual([true, false, false]);
	});
});
