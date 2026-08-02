import { describe, expect, it } from 'vitest';

import type { BackDecision } from './back';

import { decideBack } from './back';

const tabRoots = ['/workout', '/templates', '/exercises', '/history'];

function decide(
	pathname: string,
	overrides: { overlayOpen?: boolean; depth?: number } = {}
): BackDecision {
	return decideBack({
		pathname,
		overlayOpen: overrides.overlayOpen ?? false,
		tabRoots,
		depth: overrides.depth ?? 3
	});
}

describe('decideBack', () => {
	it('closes an open overlay before anything else, wherever back is pressed', () => {
		expect(decide('/workout', { overlayOpen: true })).toEqual({ kind: 'close-overlay' });
		expect(decide('/history/abc', { overlayOpen: true })).toEqual({ kind: 'close-overlay' });
		expect(decide('/settings', { overlayOpen: true, depth: 0 })).toEqual({
			kind: 'close-overlay'
		});
	});

	it('minimizes at every tab root — tabs are peers, there is no funnel through home', () => {
		for (const root of tabRoots) {
			expect(decide(root)).toEqual({ kind: 'minimize' });
		}
	});

	it('minimizes at a tab root even with history behind it, so back never replays tab taps', () => {
		expect(decide('/workout', { depth: 9 })).toEqual({ kind: 'minimize' });
	});

	it('walks real history from a screen inside a tab, so back is where the user was', () => {
		// The case the fixed parent got wrong: reached from the exercise screen's
		// link into the workout, `/history` is a list this user never visited.
		expect(decide('/history/abc')).toEqual({ kind: 'history-back' });
		expect(decide('/templates/t1')).toEqual({ kind: 'history-back' });
		expect(decide('/exercises/bench-press')).toEqual({ kind: 'history-back' });
	});

	it('falls back to the tab root when nothing of ours is behind — a deep link, a cold boot', () => {
		expect(decide('/history/abc', { depth: 0 })).toEqual({ kind: 'goto', path: '/history' });
		expect(decide('/templates/t1', { depth: 0 })).toEqual({ kind: 'goto', path: '/templates' });
		expect(decide('/exercises/bench-press', { depth: 0 })).toEqual({
			kind: 'goto',
			path: '/exercises'
		});
	});

	it('matches tab roots on segments, not prefixes', () => {
		// A route that merely starts with a tab root's characters is not inside it,
		// so it has no parent to fall back to.
		expect(decide('/historyx', { depth: 0 })).toEqual({ kind: 'minimize' });
	});

	it('walks real history off the tab grid, when there is history to walk', () => {
		expect(decide('/settings')).toEqual({ kind: 'history-back' });
	});

	it('minimizes off the tab grid when the stack has nothing behind it', () => {
		expect(decide('/settings', { depth: 0 })).toEqual({ kind: 'minimize' });
	});
});
