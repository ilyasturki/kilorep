import { describe, expect, it } from 'vitest';

import type { Move } from './move';

import { classifyMove } from './move';

const tabRoots = ['/dashboard', '/workout', '/history', '/templates', '/exercises'];
const barless = ['/settings'];

function move(from: string, to: string, delta?: number): Move {
	return classifyMove({ from, to, delta, tabRoots, barless });
}

describe('classifyMove — axis', () => {
	it('is lateral between two tabs, in the bar’s own order', () => {
		expect(move('/dashboard', '/history')).toMatchObject({ axis: 'lateral', direction: 'push' });
		expect(move('/history', '/dashboard')).toMatchObject({ axis: 'lateral', direction: 'pop' });
	});

	it('is lateral between two tabs even when both ends are detail screens', () => {
		expect(move('/exercises/abc', '/history/xyz')).toMatchObject({
			axis: 'lateral',
			direction: 'pop'
		});
		expect(move('/history/xyz', '/exercises/abc')).toMatchObject({
			axis: 'lateral',
			direction: 'push'
		});
	});

	it('is depth within one tab, in both directions', () => {
		expect(move('/history', '/history/abc')).toMatchObject({ axis: 'depth', direction: 'push' });
		expect(move('/history/abc', '/history')).toMatchObject({ axis: 'depth', direction: 'pop' });
		expect(move('/workout', '/workout/live')).toMatchObject({ axis: 'depth', direction: 'push' });
	});

	it('is depth off the bar — Settings, and Weight, which is no tab', () => {
		expect(move('/workout', '/settings')).toMatchObject({ axis: 'depth', direction: 'push' });
		expect(move('/dashboard', '/weight')).toMatchObject({ axis: 'depth', direction: 'push' });
	});

	it('reads a backwards traversal as a pop even where no path prefix says so', () => {
		expect(move('/settings', '/dashboard', -1)).toMatchObject({ axis: 'depth', direction: 'pop' });
		expect(move('/weight', '/dashboard', -1)).toMatchObject({ axis: 'depth', direction: 'pop' });
	});

	it('lets the bar outrank a traversal, so a tab tap and a back to it agree', () => {
		expect(move('/exercises', '/dashboard', -1)).toMatchObject({ axis: 'lateral' });
	});

	it('does not mistake a shared prefix for a tab', () => {
		expect(move('/dashboard', '/workout-notes')).toMatchObject({ axis: 'depth' });
	});
});

describe('classifyMove — bar', () => {
	it('holds the bar wherever both sides render one', () => {
		expect(move('/dashboard', '/history').bar).toBe('hold');
		expect(move('/history', '/history/abc').bar).toBe('hold');
		expect(move('/dashboard', '/weight').bar).toBe('hold');
	});

	it('travels the bar in and out of Settings, the one screen without one', () => {
		expect(move('/workout', '/settings').bar).toBe('travel');
		expect(move('/settings', '/workout', -1).bar).toBe('travel');
	});

	it('holds the bar for a move within Settings, where there is none on either side', () => {
		expect(move('/settings', '/settings/tokens').bar).toBe('hold');
	});
});
