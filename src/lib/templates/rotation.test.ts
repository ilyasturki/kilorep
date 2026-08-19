import { describe, expect, test } from 'vitest';

import { lastDoneByTemplate, nextUp, startable } from '$lib/templates/rotation';

import type { Template } from '$lib/domain/template';
import type { Workout } from '$lib/domain/workout';

function plan(id: string, archivedAt?: number | null): Template {
	return { id, name: id, createdAt: 0, entries: [], archivedAt };
}

function session(templateId: string | null, startedAt: number): Workout {
	return { id: `w-${startedAt}`, templateId, startedAt, entries: [] };
}

const push = plan('push');
const pull = plan('pull');
const legs = plan('legs');

const split = [push, pull, legs];

function chosen(plans: Template[], done: Record<string, number>): string | null {
	const up = nextUp(plans, done);

	return up === null ? null : up.id;
}

describe('startable', () => {
	test('keeps the order it is given, which is the order the lifter dragged', () => {
		expect(startable(split).map((template) => template.id)).toEqual(['push', 'pull', 'legs']);
	});

	test('drops an archived plan, which no tap on this screen may start', () => {
		expect(startable([push, plan('old', 500), legs]).map((template) => template.id)).toEqual([
			'push',
			'legs'
		]);
	});

	test('keeps a plan whose archivedAt was cleared rather than removed', () => {
		expect(startable([plan('back', null)])).toHaveLength(1);
	});
});

describe('lastDoneByTemplate', () => {
	test('takes the latest session per plan, not the first one it walks past', () => {
		const done = lastDoneByTemplate([
			session('push', 300),
			session('push', 100),
			session('pull', 200)
		]);

		expect(done).toEqual({ push: 300, pull: 200 });
	});

	test('leaves an untrained plan absent rather than stamping it zero', () => {
		expect(lastDoneByTemplate([session('push', 100)]).pull).toBeUndefined();
	});

	test('ignores a session that ran no plan — an empty workout answers for nothing', () => {
		expect(lastDoneByTemplate([session(null, 100)])).toEqual({});
	});
});

describe('nextUp', () => {
	test('steps to the plan after the one last trained', () => {
		const done = lastDoneByTemplate([session('push', 100)]);

		expect(chosen(split, done)).toBe('pull');
	});

	test('wraps from the tail back to the head', () => {
		const done = lastDoneByTemplate([session('legs', 100)]);

		expect(chosen(split, done)).toBe('push');
	});

	test('reads the head when nothing in the rotation has been trained', () => {
		expect(chosen(split, {})).toBe('push');
	});

	test('anchors on the last session that ran a plan, walking past an empty workout', () => {
		const done = lastDoneByTemplate([session('pull', 100), session(null, 200)]);

		expect(chosen(split, done)).toBe('legs');
	});

	test('anchors on the latest plan session even when history arrives out of order', () => {
		const done = lastDoneByTemplate([session('legs', 300), session('push', 400)]);

		expect(chosen(split, done)).toBe('pull');
	});

	test('reads position, not staleness: a plan trained today still steps to the next', () => {
		const done = lastDoneByTemplate([session('pull', 1), session('push', 900)]);

		expect(chosen(split, done)).toBe('pull');
	});

	test('ignores a plan no longer in the rotation, anchoring on the last one still in it', () => {
		const done = lastDoneByTemplate([session('push', 100), session('retired', 200)]);

		expect(chosen(split, done)).toBe('pull');
	});

	test('stays put with a single plan, which is always both last and next', () => {
		expect(chosen([push], { push: 100 })).toBe('push');
	});

	test('has nothing to offer without a plan to offer', () => {
		expect(chosen([], {})).toBeNull();
	});
});
