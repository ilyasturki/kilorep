import { describe, expect, it } from 'vitest';

import type { Direction } from './move';

import { classifyMove } from './move';

const tabRoots = ['/workout', '/templates', '/exercises', '/dashboard', '/settings'];

function move(from: string, to: string, delta?: number): Direction | undefined {
	return classifyMove({ from, to, delta, tabRoots });
}

describe('classifyMove — whether it travels', () => {
	it('does not travel between two tabs, in either direction or by back', () => {
		expect(move('/workout', '/dashboard')).toBeUndefined();
		expect(move('/dashboard', '/workout')).toBeUndefined();
		expect(move('/exercises', '/dashboard', -1)).toBeUndefined();
	});

	it('travels to a detail screen under another tab, which is deeper and not a peer', () => {
		expect(move('/dashboard', '/exercises/abc')).toBe('push');
		expect(move('/exercises/abc', '/history/xyz')).toBe('push');
		expect(move('/exercises/abc', '/dashboard', -1)).toBe('pop');
	});

	it('travels within one tab, in both directions', () => {
		expect(move('/templates', '/templates/abc')).toBe('push');
		expect(move('/templates/abc', '/templates')).toBe('pop');
		expect(move('/workout', '/workout/live')).toBe('push');
	});

	it('reads a backwards traversal as a pop even where no path prefix says so', () => {
		expect(move('/weight', '/dashboard', -1)).toBe('pop');
	});

	it('does not mistake a shared prefix for a tab', () => {
		expect(move('/dashboard', '/workout-notes')).toBe('push');
	});
});
