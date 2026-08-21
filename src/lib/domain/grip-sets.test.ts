import { describe, expect, test } from 'vitest';

import type { Exercise } from '$lib/domain/exercise';
import {
	addSet,
	armsOf,
	commitSet,
	cursorFor,
	entryCursors,
	hintLabel,
	prefillFor,
	repeatFrom,
	setExerciseGrip,
	setSetArms,
	setSetGrip
} from '$lib/domain/workout';
import type { History, Workout, WorkoutExercise, WorkoutSet } from '$lib/domain/workout';

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

function open(id: string, grip?: string, type: WorkoutSet['type'] = 'normal'): WorkoutSet {
	const set: WorkoutSet = {
		id,
		type,
		plannedReps: null,
		weight: null,
		reps: null,
		rpe: null,
		completed: false
	};

	if (grip !== undefined) {
		set.grip = grip;
	}

	return set;
}

function session(grip?: string, ...sets: WorkoutSet[]): Workout {
	const exercise: WorkoutExercise = { id: 'we', exerciseId: 'triceps-pushdown', sets };

	if (grip !== undefined) {
		exercise.grip = grip;
	}

	return {
		id: 'w',
		templateId: null,
		startedAt: 0,
		entries: [{ id: 'e', exercises: [exercise] }]
	};
}

const history: History = {
	'triceps-pushdown': [
		{ weight: 30, reps: 12, rpe: null },
		{ weight: 30, reps: 11, rpe: null },
		{ weight: 30, reps: 10, rpe: null }
	],
	'triceps-pushdown#bar': [
		{ weight: 45, reps: 10, rpe: null },
		{ weight: 45, reps: 9, rpe: null }
	]
};

describe('hintIndex', () => {
	test('counts the grip where the label counts the exercise', () => {
		const workout = session(
			'rope',
			open('s1', 'rope'),
			open('s2', 'rope'),
			open('s3', 'bar'),
			open('s4', 'bar')
		);

		const [a, b, c, d] = entryCursors(workout.entries[0]);

		expect([a, b, c, d].map((cursor) => cursor.workingIndex)).toEqual([0, 1, 2, 3]);
		expect([a, b, c, d].map((cursor) => cursor.hintIndex)).toEqual([0, 1, 0, 1]);

		// So the first bar set recalls the first bar set, not the third rope one. The bar's
		// history has two entries; the fourth set of the exercise is its second, and asking for
		// a fourth would go quiet on a set that has last time's numbers to give.
		expect(hintLabel(history, cursorFor(workout, 's2')!, pushdown)).toBe('30 × 11');
		expect(hintLabel(history, cursorFor(workout, 's3')!, pushdown)).toBe('45 × 10');
		expect(hintLabel(history, cursorFor(workout, 's4')!, pushdown)).toBe('45 × 9');
	});

	test('a warmup counts for neither', () => {
		const workout = session('rope', open('w1', 'rope', 'warmup'), open('s1', 'rope'));
		const [warm, first] = entryCursors(workout.entries[0]);

		expect(warm.hintIndex).toBe(-1);
		expect(first.hintIndex).toBe(0);
	});
});

describe('setExerciseGrip', () => {
	test('moves the sets still to come and leaves what is already logged alone', () => {
		const workout = session('rope', open('s1', 'rope'), open('s2', 'rope'), open('s3', 'rope'));

		commitSet(workout, 's1', 30, 12);
		setExerciseGrip(workout, 'we', pushdown, 'bar');

		expect(cursorFor(workout, 's1')!.set.grip).toBe('rope');
		expect(cursorFor(workout, 's2')!.set.grip).toBe('bar');
		expect(cursorFor(workout, 's3')!.set.grip).toBe('bar');
	});

	// Without this the logged sets would follow the leg by inheritance and the rope's work
	// would silently become the bar's.
	test('stamps sets that never named a grip before it moves the leg', () => {
		const workout = session(undefined, open('s1'), open('s2'));

		commitSet(workout, 's1', 30, 12);
		setExerciseGrip(workout, 'we', pushdown, 'bar');

		expect(cursorFor(workout, 's1')!.set.grip).toBe('rope');
		expect(cursorFor(workout, 's2')!.set.grip).toBe('bar');
	});

	test('a value the catalogue does not list is refused rather than filed somewhere unreachable', () => {
		const workout = session('rope', open('s1', 'rope'));

		expect(setExerciseGrip(workout, 'we', pushdown, 'v-bar')).toBe(true);
		expect(cursorFor(workout, 's1')!.set.grip).toBe('rope');
		expect(setExerciseGrip(workout, 'we', undefined, 'bar')).toBe(false);
	});

	test('a set added afterwards inherits the leg', () => {
		const workout = session('rope', open('s1', 'rope'));

		setExerciseGrip(workout, 'we', pushdown, 'bar');
		addSet(workout, 'we', 's2');

		expect(cursorFor(workout, 's2')!.set.grip).toBe('bar');
	});
});

describe('setSetGrip', () => {
	test('changes one set without touching the exercise', () => {
		const workout = session('rope', open('s1', 'rope'), open('s2', 'rope'));

		setSetGrip(workout, 's2', pushdown, 'bar');

		expect(cursorFor(workout, 's1')!.set.grip).toBe('rope');
		expect(cursorFor(workout, 's2')!.set.grip).toBe('bar');
		expect(workout.entries[0].exercises[0].grip).toBe('rope');
	});
});

describe('arms', () => {
	test('both is the absence of an annotation, not a second thing stored', () => {
		const workout = session('rope', open('s1', 'rope'));

		setSetArms(workout, 's1', 'one');
		expect(cursorFor(workout, 's1')!.set.arms).toBe('one');
		expect(armsOf(cursorFor(workout, 's1')!.set)).toBe('one');

		setSetArms(workout, 's1', 'both');
		expect(Object.hasOwn(cursorFor(workout, 's1')!.set, 'arms')).toBe(false);
		expect(armsOf(cursorFor(workout, 's1')!.set)).toBe('both');
	});
});

describe('prefill across a grip change', () => {
	test('carries only from a set on the same grip, then falls through to that grip’s history', () => {
		const workout = session('rope', open('s1', 'rope'), open('s2', 'bar'));

		commitSet(workout, 's1', 32.5, 12);

		expect(prefillFor(cursorFor(workout, 's2')!, history, pushdown)).toEqual({
			weight: 45,
			reps: 10
		});
	});

	test('and still carries within one grip', () => {
		const workout = session('rope', open('s1', 'rope'), open('s2', 'rope'));

		commitSet(workout, 's1', 32.5, 12);

		expect(prefillFor(cursorFor(workout, 's2')!, history, pushdown)).toEqual({
			weight: 32.5,
			reps: 12
		});
	});
});

describe('repeatFrom', () => {
	test('carries the grip and drops the arms — one is the setup, the other is the day', () => {
		const workout = session('bar', open('s1', 'bar'), open('s2', 'bar'));

		commitSet(workout, 's1', 45, 10);
		commitSet(workout, 's2', 45, 9);
		setSetArms(workout, 's2', 'one');

		let n = 0;
		const repeated = repeatFrom(workout, 1000, () => `r-${(n += 1)}`);
		const exercise = repeated.entries[0].exercises[0];

		expect(exercise.grip).toBe('bar');
		expect(exercise.sets.map((set) => set.grip)).toEqual(['bar', 'bar']);
		expect(exercise.sets.every((set) => set.arms === undefined)).toBe(true);
		expect(exercise.sets.every((set) => set.weight === null)).toBe(true);
	});
});
