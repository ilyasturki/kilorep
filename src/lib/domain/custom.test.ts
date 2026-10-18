import { describe, expect, test } from 'vitest';

import { catalog } from '$lib/catalog';
import {
	CUSTOM_DEFAULT_GRIP,
	customExerciseId,
	customGripId,
	isCustomId,
	isCustomRecord,
	newCustomId,
	settleDraft,
	withCustoms
} from '$lib/domain/custom';
import type { CustomExercisePreference, PreferenceRow } from '$lib/domain/custom';
import { gripLabel, gripsOf, settleGrip } from '$lib/domain/grip';
import { noteId } from '$lib/domain/preference';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const landmine: CustomExercisePreference = {
	name: 'Landmine Press',
	equipment: 'Barbell',
	loadMode: 'total',
	muscles: { primary: 'Shoulders', secondary: ['Chest', 'Triceps'] },
	variantOf: null,
	archivedAt: null
};

const row = (id: string, payload: unknown): PreferenceRow => ({ id, payload });

const custom = (id: string, change: Record<string, unknown>): PreferenceRow =>
	row(customExerciseId(id), Object.assign(structuredClone(landmine), change));

describe('custom ids', () => {
	test('are never shaped like a slug, so no catalog entry can ever answer to one', () => {
		for (let i = 0; i < 200; i += 1) {
			const id = newCustomId();

			expect(id).not.toMatch(SLUG);
			expect(isCustomId(id)).toBe(true);
		}
	});

	test('a catalog slug is never read as a custom', () => {
		for (const exercise of catalog) {
			expect(isCustomId(exercise.id), exercise.id).toBe(false);
		}
	});

	test('the reserved default grip is no value any catalog axis offers', () => {
		for (const exercise of catalog) {
			expect(
				gripsOf(exercise).map((grip) => grip.id),
				exercise.id
			).not.toContain(CUSTOM_DEFAULT_GRIP);
		}
	});

	test('their records sit under prefixes no other preference uses', () => {
		expect(isCustomRecord(customExerciseId('custom_a'))).toBe(true);
		expect(isCustomRecord(customGripId('custom_b'))).toBe(true);
		expect(isCustomRecord(noteId('custom_a'))).toBe(false);
		expect(isCustomRecord('rest-default')).toBe(false);
	});
});

describe('withCustoms', () => {
	test('with no records is the catalog as it ships', () => {
		const merged = withCustoms(catalog, []);

		expect(merged.exercises).toEqual(catalog);
		expect(merged.byId['bench-press']).toBe(catalog.find((e) => e.id === 'bench-press'));
	});

	test('adds a custom beside the catalog, marked as one, with no aliases', () => {
		const merged = withCustoms(catalog, [row(customExerciseId('custom_lm'), landmine)]);
		const exercise = merged.byId.custom_lm;

		expect(exercise).toMatchObject({
			id: 'custom_lm',
			name: 'Landmine Press',
			equipment: 'Barbell',
			custom: true,
			aliases: []
		});
		expect(exercise.variantOf).toBeUndefined();
		expect(merged.exercises).toContain(exercise);
	});

	test('hangs a variant under its root and borrows the family pattern', () => {
		const merged = withCustoms(catalog, [custom('custom_v', { variantOf: 'incline-bench-press' })]);

		expect(merged.byId.custom_v.variantOf).toBe('bench-press');
		expect(merged.byId.custom_v.pattern).toBe('horizontal-press');
	});

	test('borrows the body-weight share only where both are body-weight movements', () => {
		const towel = withCustoms(catalog, [
			custom('custom_t', { equipment: 'Bodyweight', variantOf: 'pull-up' })
		]).byId.custom_t;

		const machine = withCustoms(catalog, [
			custom('custom_m', { equipment: 'Machine', variantOf: 'pull-up' })
		]).byId.custom_m;

		expect(towel.bodyweightShare).toBe(1);
		expect(machine.bodyweightShare).toBeUndefined();
	});

	test('a variant of something the catalog never had stands alone', () => {
		const merged = withCustoms(catalog, [custom('custom_x', { variantOf: 'no-such-slug' })]);

		expect(merged.byId.custom_x.variantOf).toBeUndefined();
	});

	test('an archived custom still resolves but is offered nowhere', () => {
		const merged = withCustoms(catalog, [custom('custom_a', { archivedAt: 5 })]);

		expect(merged.byId.custom_a).toMatchObject({ archived: true, name: 'Landmine Press' });
		expect(merged.exercises.map((e) => e.id)).not.toContain('custom_a');
	});

	test('a malformed payload, or an id outside the custom alphabet, reads as absent', () => {
		const merged = withCustoms(catalog, [
			custom('custom_bad', { equipment: 'Rowing machine' }),
			custom('custom_blank', { name: '  ' }),
			row(customExerciseId('bench-press'), landmine),
			row(customGripId('wide'), { exerciseId: 'bench-press', label: 'Wide', createdAt: 1 })
		]);

		expect(merged.byId.custom_bad).toBeUndefined();
		expect(merged.byId.custom_blank).toBeUndefined();
		expect(merged.byId['bench-press'].name).toBe('Bench Press');
		expect(gripsOf(merged.byId['bench-press']).map((g) => g.id)).toEqual(['standard', 'close']);
	});

	test('appends a custom grip to an axis, in the order they were made, without touching the catalog', () => {
		const merged = withCustoms(catalog, [
			row(customGripId('custom_g2'), { exerciseId: 'bench-press', label: 'Wide', createdAt: 2 }),
			row(customGripId('custom_g1'), {
				exerciseId: 'bench-press',
				label: ' Reverse ',
				createdAt: 1
			})
		]);

		const bench = merged.byId['bench-press'];

		expect(gripsOf(bench).map((g) => g.label)).toEqual(['Standard', 'Close', 'Reverse', 'Wide']);
		expect(gripsOf(bench).at(-1)).toMatchObject({ id: 'custom_g2', custom: true });
		expect(bench.grips!.default).toBe('standard');
		expect(gripsOf(catalog.find((e) => e.id === 'bench-press'))).toHaveLength(2);
	});

	test('gives an exercise without an axis one, with a default every older set reads as', () => {
		const merged = withCustoms(catalog, [
			row(customGripId('custom_g'), { exerciseId: 'leg-press', label: 'Narrow', createdAt: 1 })
		]);

		const press = merged.byId['leg-press'];

		expect(press.grips).toMatchObject({ label: 'Grip', default: CUSTOM_DEFAULT_GRIP });
		expect(settleGrip(press, null)).toBe(CUSTOM_DEFAULT_GRIP);
		expect(gripLabel(press, null)).toBe('Standard');
		expect(gripLabel(press, 'custom_g')).toBe('Narrow');
	});

	test('carries grips on a custom exercise, and drops the grips of one that is gone', () => {
		const merged = withCustoms(catalog, [
			row(customExerciseId('custom_lm'), landmine),
			row(customGripId('custom_g'), { exerciseId: 'custom_lm', label: 'One hand', createdAt: 1 }),
			row(customGripId('custom_o'), { exerciseId: 'custom_gone', label: 'Wide', createdAt: 1 })
		]);

		expect(gripsOf(merged.byId.custom_lm).map((g) => g.label)).toEqual(['Standard', 'One hand']);
		expect(merged.byId.custom_gone).toBeUndefined();
	});

	test('a deleted grip reads as the axis default on the sets that carried it', () => {
		const merged = withCustoms(catalog, []);

		expect(settleGrip(merged.byId['bench-press'], 'custom_gone')).toBe('standard');
	});
});

describe('settleDraft', () => {
	test('trims the name and keeps the primary out of the secondaries, in muscle order', () => {
		expect(
			settleDraft({
				name: '  Landmine   Press ',
				equipment: 'Barbell',
				loadMode: 'total',
				muscles: { primary: 'Shoulders', secondary: ['Triceps', 'Shoulders', 'Chest'] },
				variantOf: null
			})
		).toEqual({
			name: 'Landmine Press',
			equipment: 'Barbell',
			loadMode: 'total',
			muscles: { primary: 'Shoulders', secondary: ['Chest', 'Triceps'] },
			variantOf: null
		});
	});
});
