import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HOLD_MS, PressTracker, SLOP } from './press';

type Tracked = {
	tracker: PressTracker;
	marks: boolean[];
	holds: () => number;
};

type Holding = 'none' | 'takes' | 'declines';

function tracked(holding: Holding = 'none'): Tracked {
	const marks: boolean[] = [];
	let count = 0;

	const tracker = new PressTracker({
		mark: (pressed: boolean): void => {
			marks.push(pressed);
		},
		hold:
			holding === 'none'
				? undefined
				: (): boolean => {
						count += 1;

						return holding === 'takes';
					}
	});

	return { tracker, marks, holds: () => count };
}

describe('press tracker', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('marks on touch-down and clears on lift', () => {
		const { tracker, marks } = tracked();

		tracker.down(1, 100, 100);
		expect(marks).toEqual([true]);

		tracker.up(1);
		expect(marks).toEqual([true, false]);
	});

	it('holds the mark while the finger stays inside the slop', () => {
		const { tracker, marks } = tracked();

		tracker.down(1, 100, 100);
		tracker.move(1, 100 + SLOP, 100);

		expect(marks).toEqual([true]);
	});

	it('releases once the press travels far enough to be a scroll', () => {
		const { tracker, marks } = tracked();

		tracker.down(1, 100, 100);
		tracker.move(1, 100, 100 + SLOP + 1);

		expect(marks).toEqual([true, false]);
	});

	it('does not recognise a hold the finger scrolled out of', () => {
		const { tracker, holds } = tracked('takes');

		tracker.down(1, 100, 100);
		tracker.move(1, 100, 100 + SLOP + 1);
		vi.advanceTimersByTime(HOLD_MS * 2);

		expect(holds()).toBe(0);
	});

	it('recognises a hold with the finger still down, and drops the mark', () => {
		const { tracker, marks, holds } = tracked('takes');

		tracker.down(1, 100, 100);
		vi.advanceTimersByTime(HOLD_MS - 1);
		expect(holds()).toBe(0);

		vi.advanceTimersByTime(1);
		expect(holds()).toBe(1);
		expect(marks).toEqual([true, false]);
	});

	it('leaves a declined hold looking like the press it still is', () => {
		const { tracker, marks, holds } = tracked('declines');

		tracker.down(1, 100, 100);
		vi.advanceTimersByTime(HOLD_MS);

		expect(holds()).toBe(1);
		expect(marks).toEqual([true]);

		tracker.up(1);

		expect(tracker.swallowsClick()).toBe(false);
	});

	it('swallows the ghost click a hold leaves behind, and only that one', () => {
		const { tracker } = tracked('takes');

		tracker.down(1, 100, 100);
		vi.advanceTimersByTime(HOLD_MS);
		tracker.up(1);

		expect(tracker.swallowsClick()).toBe(true);
		expect(tracker.swallowsClick()).toBe(false);
	});

	it('does not let an unspent swallow eat the next tap', () => {
		const { tracker } = tracked('takes');

		tracker.down(1, 100, 100);
		vi.advanceTimersByTime(HOLD_MS);
		tracker.up(1);

		tracker.down(1, 100, 100);
		tracker.up(1);

		expect(tracker.swallowsClick()).toBe(false);
	});

	it('ignores a second finger without disturbing the first', () => {
		const { tracker, marks, holds } = tracked('takes');

		tracker.down(1, 100, 100);
		tracker.down(2, 300, 300);
		tracker.move(2, 300, 900);
		tracker.up(2);

		expect(marks).toEqual([true]);

		vi.advanceTimersByTime(HOLD_MS);
		expect(holds()).toBe(1);
	});

	it('gives the press up when another gesture takes the pointer', () => {
		const { tracker, marks, holds } = tracked('takes');

		tracker.down(1, 100, 100);
		tracker.cancel();
		vi.advanceTimersByTime(HOLD_MS);

		expect(marks).toEqual([true, false]);
		expect(holds()).toBe(0);
	});
});
