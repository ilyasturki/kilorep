import { describe, expect, it } from 'vitest';

import type { Move } from './move';

import { classifyMove } from './move';

const tabRoots = ['/dashboard', '/workout', '/history', '/templates', '/exercises'];
const barless = ['/settings'];

function move(from: string, to: string, delta?: number): Move | undefined {
	return classifyMove({ from, to, delta, tabRoots, barless });
}

describe('classifyMove — whether it travels', () => {
	it('does not travel between two tabs, in either direction or by back', () => {
		expect(move('/dashboard', '/history')).toBeUndefined();
		expect(move('/history', '/dashboard')).toBeUndefined();
		expect(move('/exercises', '/dashboard', -1)).toBeUndefined();
	});

	it('travels to a detail screen under another tab, which is deeper and not a peer', () => {
		expect(move('/dashboard', '/exercises/abc')).toMatchObject({ direction: 'push' });
		expect(move('/exercises/abc', '/history/xyz')).toMatchObject({ direction: 'push' });
		expect(move('/exercises/abc', '/dashboard', -1)).toMatchObject({ direction: 'pop' });
	});

	it('travels within one tab, in both directions', () => {
		expect(move('/history', '/history/abc')).toMatchObject({ direction: 'push' });
		expect(move('/history/abc', '/history')).toMatchObject({ direction: 'pop' });
		expect(move('/workout', '/workout/live')).toMatchObject({ direction: 'push' });
	});

	it('travels off the bar — Settings, and Weight, which is no tab', () => {
		expect(move('/workout', '/settings')).toMatchObject({ direction: 'push' });
		expect(move('/dashboard', '/weight')).toMatchObject({ direction: 'push' });
	});

	it('reads a backwards traversal as a pop even where no path prefix says so', () => {
		expect(move('/settings', '/dashboard', -1)).toMatchObject({ direction: 'pop' });
		expect(move('/weight', '/dashboard', -1)).toMatchObject({ direction: 'pop' });
	});

	it('does not mistake a shared prefix for a tab', () => {
		expect(move('/dashboard', '/workout-notes')).toMatchObject({ direction: 'push' });
	});
});

describe('classifyMove — bar', () => {
	it('holds the bar wherever both sides render one', () => {
		expect(move('/history', '/history/abc')).toMatchObject({ bar: 'hold' });
		expect(move('/dashboard', '/weight')).toMatchObject({ bar: 'hold' });
	});

	it('travels the bar in and out of Settings, the one screen without one', () => {
		expect(move('/workout', '/settings')).toMatchObject({ bar: 'travel' });
		expect(move('/settings', '/workout', -1)).toMatchObject({ bar: 'travel' });
	});

	it('holds the bar for a move within Settings, where there is none on either side', () => {
		expect(move('/settings', '/settings/tokens')).toMatchObject({ bar: 'hold' });
	});
});
