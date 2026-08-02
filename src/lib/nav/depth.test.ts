import { describe, expect, it } from 'vitest';

import { depthAfter, depthOnEnter } from './depth';

describe('depthOnEnter', () => {
	it('starts over on a fresh navigation into the app — nothing of ours is behind it', () => {
		expect(depthOnEnter(4, 'navigate')).toBe(0);
	});

	it('keeps the count through a reload, because the entries survive it', () => {
		expect(depthOnEnter(4, 'reload')).toBe(4);
	});

	it('keeps the count when the app is re-entered by back or forward', () => {
		expect(depthOnEnter(4, 'back_forward')).toBe(4);
	});

	it('never trusts a stored count below zero', () => {
		expect(depthOnEnter(-2, 'reload')).toBe(0);
	});
});

describe('depthAfter', () => {
	it('counts every way the app pushes an entry', () => {
		expect(depthAfter(0, { type: 'link' })).toBe(1);
		expect(depthAfter(1, { type: 'goto' })).toBe(2);
		expect(depthAfter(2, { type: 'form' })).toBe(3);
	});

	it('follows a popstate by its signed delta, so forward counts back up', () => {
		expect(depthAfter(3, { type: 'popstate', delta: -1 })).toBe(2);
		expect(depthAfter(3, { type: 'popstate', delta: -3 })).toBe(0);
		expect(depthAfter(1, { type: 'popstate', delta: 1 })).toBe(2);
	});

	it('never goes below zero, however far back a popstate jumped', () => {
		expect(depthAfter(1, { type: 'popstate', delta: -6 })).toBe(0);
	});

	it('ignores the navigations that are not steps within the app', () => {
		expect(depthAfter(2, { type: 'enter' })).toBe(2);
		expect(depthAfter(2, { type: 'leave' })).toBe(2);
	});
});
