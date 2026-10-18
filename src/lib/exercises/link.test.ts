import { describe, expect, test } from 'vitest';

import { exerciseHref, foldedHref } from '$lib/exercises/link';

describe('exerciseHref', () => {
	test('a plain address when nothing rides along', () => {
		expect(exerciseHref('pull-up')).toBe('/plan/exercises/pull-up');
		expect(exerciseHref('pull-up', null, null)).toBe('/plan/exercises/pull-up');
	});

	test('the grip in use rides along', () => {
		expect(exerciseHref('pull-up', 'underhand')).toBe('/plan/exercises/pull-up?grip=underhand');
	});

	test('beside the way back', () => {
		const href = exerciseHref('pull-up', 'underhand', '/history/a?b');
		const url = new URL(href, 'https://kilorep.test');

		expect(url.searchParams.get('grip')).toBe('underhand');
		expect(url.searchParams.get('from')).toBe('/history/a?b');
	});
});

describe('foldedHref', () => {
	test('a retired slug opens its parent on the grip it became', () => {
		expect(foldedHref('chin-up', '')).toBe('/plan/exercises/pull-up?grip=underhand');
		expect(foldedHref('close-grip-bench-press', '?from=%2Ftrain%2Flive')).toBe(
			'/plan/exercises/bench-press?from=%2Ftrain%2Flive&grip=close'
		);
	});

	test('a grip already asked for wins over the fold’s', () => {
		expect(foldedHref('chin-up', '?grip=neutral')).toBe('/plan/exercises/pull-up?grip=neutral');
	});

	test('a live slug is not folded', () => {
		expect(foldedHref('pull-up', '?grip=underhand')).toBeNull();
	});
});
