import { describe, expect, test } from 'vitest';

import { catalogById } from '$lib/catalog';
import { freshWorkout } from '$lib/domain/fixture';
import { joinEntry } from '$lib/domain/workout';
import type { Workout } from '$lib/domain/workout';
import { entriesWithMeta, legLetter, legName } from '$lib/workout/groups';
import type { Entry } from '$lib/workout/groups';

function paired(): Entry[] {
	const workout = freshWorkout(0);

	joinEntry(workout, 'entry-3', 'we-pecdeck');
	Object.assign(workout.entries[2].exercises[1], { exerciseId: 'triceps-pushdown', grip: 'rope' });

	return entriesWithMeta(workout, catalogById);
}

describe('legName', () => {
	test('a superset leg is named by its letter, its name and its grip', () => {
		const superset = paired()[2];

		expect(legName(superset, 'we-fly')).toBe('A · Cable Fly');
		expect(legName(superset, 'we-pecdeck')).toBe('B · Triceps Pushdown · Rope');
	});

	test('a lone exercise says nothing: its row already does', () => {
		expect(legName(paired()[0], 'we-bench')).toBeNull();
	});

	test('a leg from another entry is not this one', () => {
		expect(legName(paired()[2], 'we-bench')).toBeNull();
	});
});

test('legs are lettered from A', () => {
	expect([0, 1, 2].map((at) => legLetter(at))).toEqual(['A', 'B', 'C']);
});

const naming = (...exerciseIds: string[]): Workout => ({
	id: 'w',
	templateId: null,
	startedAt: 0,
	entries: [
		{
			id: 'e',
			exercises: exerciseIds.map((exerciseId, index) => ({
				id: `x${index}`,
				exerciseId,
				sets: [
					{
						id: `s${index}`,
						type: 'normal',
						plannedReps: null,
						weight: 40,
						reps: 8,
						rpe: null,
						completed: true
					}
				]
			}))
		}
	]
});

describe('entriesWithMeta', () => {
	// What a store that predates a custom, or lost it to another device's delete, hands the screens.
	test('an exercise nobody here knows still draws, under a name that says so', () => {
		const [entry] = entriesWithMeta(naming('bench-press', 'custom_elsewhere'), catalogById);

		expect(entry.legs.map((leg) => leg.meta.name)).toEqual(['Bench Press', 'Unknown exercise']);
		expect(entry.legs[1].meta).toMatchObject({ id: 'custom_elsewhere', loadMode: 'total' });
		expect(entry.title).toBe('Bench Press + Unknown exercise');
		expect(entry.cursors).toHaveLength(2);
	});
});
