import { describe, expect, test } from 'vitest';

import { freshWorkout } from '$lib/domain/fixture';
import { commitSet, cursorFor } from '$lib/domain/workout';

import { WorkoutSession } from './session.svelte.ts';

function legOf(session: WorkoutSession): string | null {
	const cursor =
		session.activeSetId === null ? null : cursorFor(session.workout, session.activeSetId);

	return cursor === null ? null : cursor.exercise.id;
}

describe('superset', () => {
	test('a cursor on the joining leg goes to where the rounds begin', () => {
		const session = new WorkoutSession({}, { workout: freshWorkout(0), activeSetId: 'fly-1' });

		session.superset('entry-2', [{ exerciseId: 'cable-fly' }]);

		expect(session.activeSetId).toBe('incline-1');
	});

	test('a cursor parked in another entry stays put', () => {
		const session = new WorkoutSession({}, { workout: freshWorkout(0), activeSetId: 'bench-2' });

		session.superset('entry-2', [{ exerciseId: 'cable-fly' }]);

		expect(session.activeSetId).toBe('bench-2');
	});

	test('a round already under way is not restarted', () => {
		const workout = freshWorkout(0);
		commitSet(workout, 'incline-1', 30, 10);

		const session = new WorkoutSession({}, { workout, activeSetId: 'incline-2' });

		session.superset('entry-2', [{ exerciseId: 'cable-fly' }]);

		expect(session.activeSetId).toBe('fly-1');
	});
});

describe('addRound', () => {
	test('the cursor lands on the first leg of the new round', () => {
		const session = new WorkoutSession({}, { workout: freshWorkout(0), activeSetId: 'bench-1' });
		session.superset('entry-3', [{ exerciseId: 'pec-deck' }]);

		session.addRound('entry-3');

		expect(legOf(session)).toBe('we-fly');
		expect(session.workout.entries[2].exercises.map((leg) => leg.sets.length)).toEqual([4, 4]);
	});

	test('on a lone exercise it is one more set', () => {
		const session = new WorkoutSession({}, { workout: freshWorkout(0), activeSetId: 'bench-1' });

		session.addRound('entry-2');

		expect(session.workout.entries[1].exercises[0].sets).toHaveLength(4);
		expect(session.activeSetId).toBe(session.workout.entries[1].exercises[0].sets[3].id);
	});
});

describe('leaveSuperset', () => {
	test('the leg steps out with its sets and the cursor stays on the set it was on', () => {
		const session = new WorkoutSession({}, { workout: freshWorkout(0), activeSetId: 'bench-1' });
		session.superset('entry-3', [{ exerciseId: 'pec-deck' }]);
		session.select('pecdeck-2');

		session.leaveSuperset('we-pecdeck');

		expect(session.workout.entries.map((entry) => entry.exercises.length)).toEqual([1, 1, 1, 1]);
		expect(session.activeSetId).toBe('pecdeck-2');
	});
});
