import { describe, expect, it } from 'vitest';

import type { Move } from './move';

import { classifyMove } from './move';

// Both halves of Plan are roots — the segment swaps between them without
// leaving the tab. Settings is one too, now that it is an ordinary tab.
const tabRoots = ['/workout', '/templates', '/exercises', '/dashboard', '/settings'];

function move(from: string, to: string, delta?: number): Move | undefined {
	return classifyMove({ from, to, delta, tabRoots });
}

describe('classifyMove — whether it travels', () => {
	it('does not travel between two tabs, in either direction or by back', () => {
		expect(move('/workout', '/dashboard')).toBeUndefined();
		expect(move('/dashboard', '/workout')).toBeUndefined();
		expect(move('/dashboard', '/workout', -1)).toBeUndefined();
	});

	it('does not travel between the two halves of Plan, which are one tab', () => {
		expect(move('/templates', '/exercises')).toBeUndefined();
		expect(move('/exercises', '/templates')).toBeUndefined();
	});

	it('does not travel in or out of Settings, which is a tab like any other', () => {
		expect(move('/workout', '/settings')).toBeUndefined();
		expect(move('/settings', '/workout', -1)).toBeUndefined();
	});

	it('travels to a detail screen under another tab, which is deeper and not a peer', () => {
		expect(move('/dashboard', '/exercises/abc')).toMatchObject({ direction: 'push' });
		expect(move('/exercises/abc', '/history/xyz')).toMatchObject({ direction: 'push' });
		expect(move('/exercises/abc', '/dashboard', -1)).toMatchObject({ direction: 'pop' });
	});

	it('travels within one tab, in both directions', () => {
		expect(move('/templates', '/templates/abc')).toMatchObject({ direction: 'push' });
		expect(move('/templates/abc', '/templates')).toMatchObject({ direction: 'pop' });
		expect(move('/workout', '/workout/live')).toMatchObject({ direction: 'push' });
	});

	it("travels to Progress' children, which are screens rather than tabs", () => {
		expect(move('/dashboard', '/history')).toMatchObject({ direction: 'push' });
		expect(move('/dashboard', '/weight')).toMatchObject({ direction: 'push' });
		expect(move('/history', '/history/abc')).toMatchObject({ direction: 'push' });
	});

	it('reads a backwards traversal as a pop even where no path prefix says so', () => {
		expect(move('/history', '/dashboard', -1)).toMatchObject({ direction: 'pop' });
		expect(move('/weight', '/dashboard', -1)).toMatchObject({ direction: 'pop' });
	});

	it('does not mistake a shared prefix for a tab', () => {
		expect(move('/dashboard', '/workout-notes')).toMatchObject({ direction: 'push' });
	});
});
