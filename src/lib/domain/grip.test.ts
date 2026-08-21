import { describe, expect, test } from 'vitest';

import type { Exercise } from '$lib/domain/exercise';
import { gripLabel, hasGrips, historyKey, musclesOf, settleGrip } from './grip.ts';

const pushdown: Exercise = {
	id: 'triceps-pushdown',
	name: 'Triceps Pushdown',
	aliases: [],
	equipment: 'Cable',
	loadMode: 'total',
	muscles: { primary: 'Triceps', secondary: [] },
	grips: {
		label: 'Attachment',
		default: 'rope',
		values: [
			{ id: 'rope', label: 'Rope' },
			{ id: 'bar', label: 'Straight Bar' }
		]
	}
};

const bench: Exercise = {
	id: 'bench-press',
	name: 'Bench Press',
	aliases: [],
	equipment: 'Barbell',
	loadMode: 'total',
	muscles: { primary: 'Chest', secondary: ['Triceps'] },
	grips: {
		label: 'Grip',
		default: 'standard',
		values: [
			{ id: 'standard', label: 'Standard' },
			{ id: 'close', label: 'Close', muscles: { primary: 'Triceps', secondary: ['Chest'] } }
		]
	}
};

const squat: Exercise = {
	id: 'squat',
	name: 'Squat',
	aliases: [],
	equipment: 'Barbell',
	loadMode: 'total',
	muscles: { primary: 'Quads', secondary: [] }
};

describe('settleGrip', () => {
	test('an exercise with no axis has no grip, whatever is asked for', () => {
		expect(settleGrip(squat, null)).toBeUndefined();
		expect(settleGrip(squat, 'rope')).toBeUndefined();
		expect(settleGrip(undefined, 'rope')).toBeUndefined();
		expect(hasGrips(squat)).toBe(false);
	});

	test('absent is the default — every set has a grip, including the ones logged before the axis', () => {
		expect(settleGrip(pushdown, null)).toBe('rope');
		expect(settleGrip(bench, null)).toBe('standard');
	});

	test('a value the catalogue no longer lists falls back rather than surviving as a dead chip', () => {
		expect(settleGrip(pushdown, 'v-bar')).toBe('rope');
	});
});

describe('historyKey', () => {
	test('the default files under the bare slug, so a year of old sets needs no migration', () => {
		expect(historyKey('triceps-pushdown', pushdown, null)).toBe('triceps-pushdown');
		expect(historyKey('triceps-pushdown', pushdown, 'rope')).toBe('triceps-pushdown');
	});

	test('every other grip files under its own key', () => {
		expect(historyKey('triceps-pushdown', pushdown, 'bar')).toBe('triceps-pushdown#bar');
	});

	test('an exercise with no axis is its slug and nothing else', () => {
		expect(historyKey('squat', squat, 'wide')).toBe('squat');
		expect(historyKey('squat', undefined, null)).toBe('squat');
	});
});

describe('musclesOf', () => {
	test('a grip that trains something else says so', () => {
		expect(musclesOf(bench, 'close').primary).toBe('Triceps');
	});

	test('and one that does not inherits the exercise', () => {
		expect(musclesOf(bench, 'standard')).toEqual(bench.muscles);
		expect(musclesOf(bench, null)).toEqual(bench.muscles);
		expect(musclesOf(squat, 'anything')).toEqual(squat.muscles);
	});
});

describe('gripLabel', () => {
	test('spells the value the way the chips do, and stays silent without an axis', () => {
		expect(gripLabel(pushdown, 'bar')).toBe('Straight Bar');
		expect(gripLabel(pushdown, null)).toBe('Rope');
		expect(gripLabel(squat, 'bar')).toBeUndefined();
	});
});
