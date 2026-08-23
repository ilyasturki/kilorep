import { describe, expect, it } from 'vitest';

import type { Direction } from './move';

import { classifyMove } from './move';

const tabRoots = [
	'/train',
	'/plan/templates',
	'/plan/exercises',
	'/progress',
	'/bodyweight',
	'/settings'
];

function move(from: string, to: string, delta?: number): Direction | undefined {
	return classifyMove({ from, to, delta, tabRoots });
}

describe('classifyMove — whether it travels', () => {
	it('does not travel between two tabs, in either direction or by back', () => {
		expect(move('/train', '/progress')).toBeUndefined();
		expect(move('/progress', '/train')).toBeUndefined();
		expect(move('/plan/exercises', '/progress', -1)).toBeUndefined();
		expect(move('/bodyweight', '/progress', -1)).toBeUndefined();
	});

	it('travels to a detail screen under another tab, which is deeper and not a peer', () => {
		expect(move('/progress', '/plan/exercises/abc')).toBe('push');
		expect(move('/plan/exercises/abc', '/history/xyz')).toBe('push');
		expect(move('/plan/exercises/abc', '/progress', -1)).toBe('pop');
	});

	it('travels within one tab, in both directions', () => {
		expect(move('/plan/templates', '/plan/templates/abc')).toBe('push');
		expect(move('/plan/templates/abc', '/plan/templates')).toBe('pop');
		expect(move('/train', '/train/live')).toBe('push');
	});

	it('reads a backwards traversal as a pop even where no path prefix says so', () => {
		expect(move('/history', '/progress', -1)).toBe('pop');
	});

	it('does not mistake a shared prefix for a tab', () => {
		expect(move('/progress', '/train-notes')).toBe('push');
	});
});
