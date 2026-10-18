import { describe, expect, it } from 'vitest';

import type { Entries } from './entries';

import { behindOf, entriesAfter, HISTORY_INDEX, stepOf } from './entries';

describe('stepOf', () => {
	it('counts a link, a goto or a form that moved the index up as a push', () => {
		expect(stepOf('link', 'navigate', 4, 5)).toBe('push');
		expect(stepOf('goto', 'navigate', 4, 5)).toBe('push');
		expect(stepOf('form', 'navigate', 4, 5)).toBe('push');
	});

	it('counts a goto that kept the index as a replace, never as one more entry', () => {
		expect(stepOf('goto', 'navigate', 5, 5)).toBe('replace');
		expect(stepOf('link', 'navigate', 5, 5)).toBe('replace');
	});

	it('takes a popstate as a walk along entries that already exist', () => {
		expect(stepOf('popstate', 'navigate', 5, 3)).toBe('traverse');
		expect(stepOf('popstate', 'navigate', 3, 4)).toBe('traverse');
	});

	it('starts over on a fresh load, and keeps what a reload or a return still holds', () => {
		expect(stepOf('enter', 'navigate', null, 7)).toBe('fresh');
		expect(stepOf('enter', 'reload', null, 7)).toBe('traverse');
		expect(stepOf('enter', 'back_forward', null, 7)).toBe('traverse');
	});
});

describe('entriesAfter', () => {
	const walked: Entries = { 1: '/progress', 2: '/history', 3: '/history/a' };

	it('drops what lay ahead when a push writes a new future', () => {
		expect(entriesAfter(structuredClone(walked), 2, '/history/b', 'push')).toEqual({
			1: '/progress',
			2: '/history/b'
		});
	});

	it('rewrites the entry in place on a replace, and keeps what lies ahead of it', () => {
		expect(entriesAfter(structuredClone(walked), 2, '/progress', 'replace')).toEqual({
			1: '/progress',
			2: '/progress',
			3: '/history/a'
		});
	});

	it('only notes the address on a traverse', () => {
		expect(entriesAfter(structuredClone(walked), 2, '/history', 'traverse')).toEqual(walked);
	});

	it('forgets everything on a fresh load', () => {
		expect(entriesAfter(structuredClone(walked), 9, '/train', 'fresh')).toEqual({ 9: '/train' });
	});
});

describe('behindOf', () => {
	it('names the entry behind, and nothing where none of ours is', () => {
		const entries: Entries = { 4: '/history', 5: '/history/a' };

		expect(behindOf(entries, 5)).toBe('/history');
		expect(behindOf(entries, 4)).toBeNull();
	});

	it('follows a replaced entry rather than the address it used to hold', () => {
		let entries: Entries = { 1: '/train', 2: '/train/live' };

		entries = entriesAfter(entries, 2, '/history/w1', stepOf('goto', 'navigate', 2, 2));
		entries = entriesAfter(entries, 3, '/plan/exercises/squat', stepOf('link', 'navigate', 2, 3));

		expect(behindOf(entries, 3)).toBe('/history/w1');
		expect(behindOf(entries, 2)).toBe('/train');
	});
});

describe('HISTORY_INDEX', () => {
	it('is the key SvelteKit stamps on every history entry it writes', () => {
		const [constants] = Object.values(
			import.meta.glob<string>('/node_modules/@sveltejs/kit/src/runtime/client/constants.js', {
				query: '?raw',
				import: 'default',
				eager: true
			})
		);

		expect(constants).toContain(`HISTORY_INDEX = '${HISTORY_INDEX}'`);
	});
});
