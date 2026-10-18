import { describe, expect, it } from 'vitest';

import { illustrationFor, resolveIllustration } from './illustration';
import drawn from './illustrations.json';

const available = new Set(['pull-up', 'pull-up--underhand', 'dip']);

describe('resolveIllustration', () => {
	it("takes the grip's own drawing first", () => {
		expect(resolveIllustration(available, 'pull-up', 'underhand')).toBe('pull-up--underhand');
	});

	it("falls back to the exercise's drawing for the default or an undrawn grip", () => {
		expect(resolveIllustration(available, 'pull-up', 'overhand')).toBe('pull-up');
		expect(resolveIllustration(available, 'dip', 'forward')).toBe('dip');
	});

	it('draws the exercise when no grip is asked for', () => {
		expect(resolveIllustration(available, 'pull-up')).toBe('pull-up');
		expect(resolveIllustration(available, 'pull-up', null)).toBe('pull-up');
	});

	it('answers nothing for an exercise without art, whatever the grip', () => {
		expect(resolveIllustration(available, 'my-custom')).toBeNull();
		expect(resolveIllustration(available, 'my-custom', 'underhand')).toBeNull();
	});

	it("never borrows another exercise's grip drawing", () => {
		expect(resolveIllustration(available, 'lat-pulldown', 'underhand')).toBeNull();
	});
});

describe('the illustration manifest', () => {
	it('lists exactly the SVGs in static/illustrations', () => {
		const files = Object.keys(import.meta.glob('/static/illustrations/*.svg'))
			.map((file) => file.replace('/static/illustrations/', '').replace(/\.svg$/u, ''))
			.toSorted();

		expect(drawn).toEqual(files);
	});

	it('is what illustrationFor reads', () => {
		expect(illustrationFor('bench-press')).toBe('bench-press');
		expect(illustrationFor('pull-up', 'underhand')).toBe('pull-up--underhand');
		expect(illustrationFor('no-such-exercise')).toBeNull();
	});
});
