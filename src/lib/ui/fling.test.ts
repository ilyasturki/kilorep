import { describe, expect, it } from 'vitest';

import { easeFling, landing } from './fling';
import type { Throw } from './fling';

const PITCH = 52;

const LO = -1000;
const HI = 1000;

function thrown(pos: number, speed: number, lo = LO, hi = HI): Throw {
	return landing(pos, speed, PITCH, lo, hi);
}

describe('landing', () => {
	it('lands on a detent, never between two', () => {
		for (const speed of [0, 0.4, 1.2, -3.7, 9]) {
			expect(Number.isInteger(thrown(4.37, speed).to)).toBe(true);
		}
	});

	it('takes the nearest detent when the finger only placed the ruler', () => {
		expect(thrown(4.4, 0).to).toBe(4);
		expect(thrown(4.6, 0).to).toBe(5);
		expect(thrown(4.4, 0.1).to).toBe(4);
	});

	it('eases into that detent rather than jumping to it', () => {
		expect(thrown(4.4, 0).ms).toBeGreaterThan(0);
	});

	it('asks for no animation when it is already on the detent', () => {
		expect(thrown(4, 0)).toEqual({ to: 4, ms: 0 });
	});

	it('carries on past the lift, downward and upward', () => {
		expect(thrown(0, 2).to).toBeGreaterThan(4);
		expect(thrown(0, -2).to).toBeLessThan(-4);
	});

	it('carries further the harder it is thrown', () => {
		expect(thrown(0, 3).to).toBeGreaterThan(thrown(0, 0.5).to);
	});

	it('stops at the ends of the ruler', () => {
		expect(thrown(9.5, 40, 0, 10).to).toBe(10);
		expect(thrown(0.5, -40, 0, 10).to).toBe(0);
	});

	it('spends longer on a longer throw, within bounds', () => {
		const near = thrown(0, 0.5).ms;
		const far = thrown(0, 3).ms;

		expect(far).toBeGreaterThan(near);
		expect(near).toBeGreaterThanOrEqual(140);
		expect(far).toBeLessThanOrEqual(650);
	});

	it('does not spend a whole throw on one the ruler cut short', () => {
		expect(thrown(9.5, 40, 0, 10).ms).toBeLessThan(thrown(0, 40, 0, 1000).ms);
	});
});

describe('easeFling', () => {
	it('starts where it starts and ends where it ends', () => {
		expect(easeFling(0)).toBe(0);
		expect(easeFling(1)).toBe(1);
	});

	it('never turns back', () => {
		let last = -1;

		for (let t = 0; t <= 1.0001; t += 0.05) {
			const now = easeFling(t);

			expect(now).toBeGreaterThanOrEqual(last);
			last = now;
		}
	});

	it('spends most of the reach early, so the tail settles', () => {
		expect(easeFling(0.3)).toBeGreaterThan(0.8);
	});
});
