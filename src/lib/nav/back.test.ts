import { describe, expect, it, vi } from 'vitest';

import type { BackDecision } from './back';

import { decideBack } from './back';
import { parentOf, tabRoots as navRoots } from './bar.svelte';

vi.mock('$lib/ui/icons/Barbell.svelte', () => ({ default: {} }));
vi.mock('$lib/ui/icons/BarbellFill.svelte', () => ({ default: {} }));
vi.mock('$lib/ui/icons/ChartBar.svelte', () => ({ default: {} }));
vi.mock('$lib/ui/icons/ChartBarFill.svelte', () => ({ default: {} }));
vi.mock('$lib/ui/icons/Gauge.svelte', () => ({ default: {} }));
vi.mock('$lib/ui/icons/GaugeFill.svelte', () => ({ default: {} }));
vi.mock('$lib/ui/icons/Gear.svelte', () => ({ default: {} }));
vi.mock('$lib/ui/icons/Stack.svelte', () => ({ default: {} }));
vi.mock('$lib/workout/active.svelte', () => ({ activeWorkout: { session: null } }));

const tabRoots = navRoots();

const LIVE = '/train/live';

function decide(
	pathname: string,
	overrides: { overlayOpen?: boolean; depth?: number } = {}
): BackDecision {
	return decideBack({
		pathname,
		overlayOpen: overrides.overlayOpen ?? false,
		tabRoots,
		parentOf,
		depth: overrides.depth ?? 3
	});
}

describe('decideBack', () => {
	it('closes an open overlay before anything else, wherever back is pressed', () => {
		expect(decide('/train', { overlayOpen: true })).toEqual({ kind: 'close-overlay' });
		expect(decide('/history/abc', { overlayOpen: true })).toEqual({ kind: 'close-overlay' });
		expect(decide('/settings', { overlayOpen: true, depth: 0 })).toEqual({
			kind: 'close-overlay'
		});
	});

	it('minimizes at every tab root but the session — tabs are peers, no funnel through home', () => {
		for (const root of tabRoots.filter((address) => address !== LIVE)) {
			expect(decide(root)).toEqual({ kind: 'minimize' });
		}
	});

	it('minimizes at a tab root even with history behind it, so back never replays tab taps', () => {
		expect(decide('/train', { depth: 9 })).toEqual({ kind: 'minimize' });
	});

	it('walks real history from a screen inside a tab, so back is where the user was', () => {
		expect(decide('/history/abc')).toEqual({ kind: 'history-back' });
		expect(decide('/plan/templates/t1')).toEqual({ kind: 'history-back' });
		expect(decide('/plan/exercises/bench-press')).toEqual({ kind: 'history-back' });
	});

	it('falls back to the tab root when nothing of ours is behind — a deep link, a cold boot', () => {
		expect(decide('/plan/templates/t1', { depth: 0 })).toEqual({
			kind: 'goto',
			path: '/plan/templates'
		});
		expect(decide('/plan/exercises/bench-press', { depth: 0 })).toEqual({
			kind: 'goto',
			path: '/plan/exercises'
		});
	});

	it('walks a child of Progress up to its list, and the list up to Progress', () => {
		expect(decide('/history/abc', { depth: 0 })).toEqual({ kind: 'goto', path: '/history' });
		expect(decide('/history', { depth: 0 })).toEqual({ kind: 'goto', path: '/progress' });
	});

	it('minimizes at Weight rather than walking to Progress, which no longer parents it', () => {
		expect(decide('/bodyweight', { depth: 0 })).toEqual({ kind: 'minimize' });
	});

	it('walks out of the live session to where the lifter came from, not out of the app', () => {
		expect(decide(LIVE)).toEqual({ kind: 'history-back' });
	});

	it('sends a cold-booted session to History, the one address that is not its own redirect', () => {
		expect(decide(LIVE, { depth: 0 })).toEqual({ kind: 'goto', path: '/history' });
	});

	it('matches roots on segments, not prefixes, and minimizes where nothing claims the address', () => {
		expect(decide('/historyx', { depth: 0 })).toEqual({ kind: 'minimize' });
	});

	it('walks real history off the tab grid, when there is history to walk', () => {
		expect(decide('/history')).toEqual({ kind: 'history-back' });
	});
});

describe('parentOf', () => {
	it('gives a tab root no parent, so the bar draws no way up from one', () => {
		for (const root of navRoots().filter((address) => address !== LIVE)) {
			expect(parentOf(root)).toBeNull();
		}
	});

	it('parents the live session on History, not the address that redirects back to it', () => {
		expect(navRoots()).toContain(LIVE);
		expect(parentOf(LIVE)).toBe('/history');
	});

	it('still walks a screen inside a tab up to the root that owns it', () => {
		expect(parentOf('/plan/exercises/bench-press')).toBe('/plan/exercises');
		expect(parentOf('/plan/templates/t1')).toBe('/plan/templates');
		expect(parentOf('/history/abc')).toBe('/history');
		expect(parentOf('/history')).toBe('/progress');
	});
});
