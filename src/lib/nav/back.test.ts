import { afterEach, describe, expect, it, vi } from 'vitest';

import { activeWorkout } from '$lib/workout/active.svelte';

import type { BackDecision } from './back';

import { decideBack } from './back';
import { backTo, openedFrom, parentOf, tabRoots as navRoots } from './bar.svelte';

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

const ORIGIN = 'https://kilorep.test';

function at(address: string): URL {
	return new URL(address, ORIGIN);
}

// The whole of a back press, the way `‹` and the hardware button both make it.
function press(address: string, behind: string | null = null, overlayOpen = false): BackDecision {
	return decideBack({ overlayOpen, target: backTo(at(address), behind), behind });
}

function running(): void {
	activeWorkout.session = {} as typeof activeWorkout.session;
}

afterEach(() => {
	activeWorkout.session = null;
});

describe('decideBack', () => {
	it('closes an open overlay before anything else, wherever back is pressed', () => {
		expect(press('/train', null, true)).toEqual({ kind: 'close-overlay' });
		expect(press('/settings', '/progress', true)).toEqual({ kind: 'close-overlay' });
	});

	it('stops editing a record rather than leaving it, the editor being an overlay', () => {
		expect(press('/history/abc', '/history', true)).toEqual({ kind: 'close-overlay' });
	});

	it('minimizes at every tab root but the session — tabs are peers, no funnel through home', () => {
		for (const root of tabRoots.filter((address) => address !== LIVE)) {
			expect(press(root)).toEqual({ kind: 'minimize' });
		}
	});

	it('minimizes at a tab root even with history behind it, so back never replays tab taps', () => {
		expect(press('/train', '/settings')).toEqual({ kind: 'minimize' });
		expect(press('/settings', '/progress')).toEqual({ kind: 'minimize' });
	});

	it('pops when the screen back walks to is the entry behind', () => {
		expect(press('/history/abc', '/history')).toEqual({ kind: 'pop' });
		expect(press('/plan/templates/t1', '/plan/templates')).toEqual({ kind: 'pop' });
		expect(press('/history', '/progress')).toEqual({ kind: 'pop' });
	});

	it('pops onto a list left filtered, which is still the list', () => {
		expect(press('/plan/exercises/bench-press', '/plan/exercises?q=press')).toEqual({
			kind: 'pop'
		});
	});

	it('replaces rather than pushes when the way back is not behind — a deep link, a jump', () => {
		expect(press('/history/abc')).toEqual({ kind: 'replace', path: '/history' });
		expect(press('/history/abc', '/train')).toEqual({ kind: 'replace', path: '/history' });
		expect(press('/history')).toEqual({ kind: 'replace', path: '/progress' });
		expect(press('/plan/exercises/bench-press')).toEqual({
			kind: 'replace',
			path: '/plan/exercises'
		});
	});

	it('holds a screen opened out of its branch to the exact address it was opened from', () => {
		const opened = '/plan/exercises/bench-press?from=%2Fprogress';

		expect(press(opened, '/progress')).toEqual({ kind: 'pop' });
		expect(press(opened)).toEqual({ kind: 'replace', path: '/progress' });

		const nested = openedFrom('/history/w1', '/plan/exercises/squat?from=%2Fprogress');

		expect(press(nested, '/plan/exercises/squat?from=%2Fprogress')).toEqual({ kind: 'pop' });
		expect(press(nested, '/plan/exercises/squat')).toEqual({
			kind: 'replace',
			path: '/plan/exercises/squat?from=%2Fprogress'
		});
	});

	it('walks out of the live session to wherever the lifter came from', () => {
		expect(press(LIVE, '/plan/templates/t1')).toEqual({ kind: 'pop' });
		expect(press(LIVE, '/history/abc')).toEqual({ kind: 'pop' });
		expect(press(LIVE, '/plan/exercises')).toEqual({ kind: 'pop' });
		expect(press(LIVE, '/train')).toEqual({ kind: 'pop' });
	});

	it('sends a session with nothing of ours behind it up to the Train home', () => {
		expect(press(LIVE)).toEqual({ kind: 'replace', path: '/train' });
		expect(press(LIVE, '/login')).toEqual({ kind: 'replace', path: '/train' });
		expect(press(LIVE, '/')).toEqual({ kind: 'replace', path: '/train' });
		expect(press(LIVE, LIVE)).toEqual({ kind: 'replace', path: '/train' });
	});

	it('walks a tab glanced at mid-session back into the session', () => {
		running();

		expect(press('/settings', LIVE)).toEqual({ kind: 'pop' });
		expect(press('/bodyweight', LIVE)).toEqual({ kind: 'pop' });
		expect(press('/settings', '/progress')).toEqual({ kind: 'minimize' });
	});

	it('lets a tab minimize once the session behind it has ended', () => {
		expect(press('/settings', LIVE)).toEqual({ kind: 'minimize' });
	});

	it('matches roots on segments, not prefixes, and minimizes where nothing claims the address', () => {
		expect(press('/historyx')).toEqual({ kind: 'minimize' });
	});
});

describe('parentOf', () => {
	it('gives a tab root no parent, so the bar draws no way up from one', () => {
		for (const root of navRoots().filter((address) => address !== LIVE)) {
			expect(parentOf(root)).toBeNull();
		}
	});

	it('parents the live session on the Train home, its fallback when nothing is behind', () => {
		expect(navRoots()).toContain(LIVE);
		expect(parentOf(LIVE)).toBe('/train');
	});

	it('walks a screen inside a tab up one step at a time', () => {
		expect(parentOf('/plan/exercises/bench-press')).toBe('/plan/exercises');
		expect(parentOf('/plan/templates/t1')).toBe('/plan/templates');
		expect(parentOf('/history/abc')).toBe('/history');
		expect(parentOf('/history')).toBe('/progress');
	});

	it('walks a plan history up to its editor, not past it to the list', () => {
		expect(parentOf('/plan/templates/t1/history')).toBe('/plan/templates/t1');
	});

	it('claims nothing outside the tabs', () => {
		expect(parentOf('/historyx')).toBeNull();
		expect(parentOf('/login')).toBeNull();
		expect(parentOf('/')).toBeNull();
	});
});

describe('backTo', () => {
	it('walks the hierarchy where the address says nothing about where it was opened from', () => {
		expect(backTo(at('/plan/exercises/bench-press'))).toBe('/plan/exercises');
		expect(backTo(at('/history/abc'))).toBe('/history');
		expect(backTo(at('/train'))).toBeNull();
	});

	it('walks back into the session a lifter opened the exercise from, not to the browse list', () => {
		expect(backTo(at('/plan/exercises/deadlift?from=%2Ftrain%2Flive'))).toBe(LIVE);
	});

	it('carries a record editor back to its own record', () => {
		expect(backTo(at('/plan/exercises/deadlift?from=%2Fhistory%2Fabc'))).toBe('/history/abc');
	});

	it('keeps every other query out of it — only `from` says where back goes', () => {
		expect(backTo(at('/plan/exercises/deadlift?q=press'))).toBe('/plan/exercises');
	});

	it('reads `from` before the entry behind, which says when, not where', () => {
		expect(backTo(at('/plan/exercises/deadlift?from=%2Fprogress'), '/plan/exercises')).toBe(
			'/progress'
		);
	});

	it('refuses anywhere that is not an address of ours, however it is dressed up', () => {
		// Assembled rather than written out: spelled whole, the lint rule against `javascript:`
		// hrefs reads the test's own fixture as one.
		const script = ['java', 'script:alert(1)'].join('');

		// `/\evil.test` is the one that reads as ours and is not: a browser folds the backslash
		// to a slash before it resolves, and the anchor lands off-site. It drops tabs and newlines
		// first, too, so a control between the two characters still makes them `//`.
		const hostile = [
			'//evil.test',
			String.raw`/\evil.test`,
			'/\t/evil.test',
			'/\n/evil.test',
			'/\r/evil.test',
			'/\t\\evil.test',
			'https://evil.test',
			script,
			''
		];

		for (const value of hostile) {
			const address = `/plan/exercises/deadlift?from=${encodeURIComponent(value)}`;

			expect(backTo(at(address))).toBe('/plan/exercises');
		}
	});

	it('reads back what the link wrote, through a path holding characters of its own', () => {
		const href = openedFrom('/plan/exercises/deadlift', '/history/a?b');

		expect(backTo(at(href))).toBe('/history/a?b');
	});
});

describe('openedFrom', () => {
	it('leaves a link alone when it has no way back to declare', () => {
		const unset: string | undefined = undefined;

		expect(openedFrom('/plan/exercises/deadlift', null)).toBe('/plan/exercises/deadlift');
		expect(openedFrom('/plan/exercises/deadlift', unset)).toBe('/plan/exercises/deadlift');
	});
});
