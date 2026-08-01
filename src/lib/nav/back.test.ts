import { describe, expect, it } from 'vitest';

import type { BackDecision } from './back';

import { decideBack } from './back';

const tabRoots = ['/workout', '/templates', '/exercises', '/history'];

function decide(
	pathname: string,
	overrides: { overlayOpen?: boolean; historyLength?: number } = {}
): BackDecision {
	return decideBack({
		pathname,
		overlayOpen: overrides.overlayOpen ?? false,
		tabRoots,
		historyLength: overrides.historyLength ?? 5
	});
}

describe('decideBack', () => {
	it('closes an open overlay before anything else, wherever back is pressed', () => {
		expect(decide('/workout', { overlayOpen: true })).toEqual({ kind: 'close-overlay' });
		expect(decide('/history/abc', { overlayOpen: true })).toEqual({ kind: 'close-overlay' });
		expect(decide('/settings', { overlayOpen: true, historyLength: 1 })).toEqual({
			kind: 'close-overlay'
		});
	});

	it('minimizes at every tab root — tabs are peers, there is no funnel through home', () => {
		for (const root of tabRoots) {
			expect(decide(root)).toEqual({ kind: 'minimize' });
		}
	});

	it('pops a screen inside a tab to that tab root', () => {
		expect(decide('/history/abc')).toEqual({ kind: 'goto', path: '/history' });
		expect(decide('/templates/t1')).toEqual({ kind: 'goto', path: '/templates' });
		expect(decide('/exercises/bench-press')).toEqual({ kind: 'goto', path: '/exercises' });
	});

	it('matches tab roots on segments, not prefixes', () => {
		// A route that merely starts with a tab root's characters is not inside it.
		expect(decide('/historyx', { historyLength: 3 })).toEqual({ kind: 'history-back' });
	});

	it('walks real history off the tab grid, when there is history to walk', () => {
		expect(decide('/settings', { historyLength: 3 })).toEqual({ kind: 'history-back' });
	});

	it('minimizes off the tab grid when the stack has nothing behind it', () => {
		expect(decide('/settings', { historyLength: 1 })).toEqual({ kind: 'minimize' });
	});
});
