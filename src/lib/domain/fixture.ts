import type { PastSession } from '$lib/domain/stats';
import type { History, Workout, WorkoutEntry, WorkoutSet } from '$lib/domain/workout';

const session = (date: number, sets: [number, number][]): PastSession => ({
	date,
	workoutId: `fixture-${date}`,
	position: 1,
	sets: sets.map(([weight, reps]) => ({ weight, reps, rpe: null }))
});

const pastSessions: Record<string, PastSession[]> = {
	'bench-press': [
		session(Date.UTC(2026, 6, 13), [
			[80, 8],
			[80, 8],
			[80, 7],
			[77.5, 7]
		])
	],
	'incline-dumbbell-press': [
		session(Date.UTC(2026, 6, 15), [
			[30, 10],
			[30, 9],
			[27.5, 9]
		])
	],
	'cable-fly': [
		session(Date.UTC(2026, 6, 15), [
			[20, 12],
			[20, 12],
			[20, 10]
		])
	]
};

export const history: History = Object.fromEntries(
	Object.entries(pastSessions).flatMap(([id, sessions]) => {
		const last = sessions.at(-1);

		return last === undefined ? [] : [[id, last.sets]];
	})
);

const working = (key: string, count: number, plannedReps: number | null): WorkoutSet[] =>
	Array.from({ length: count }, (_, i) => ({
		id: `${key}-${i + 1}`,
		type: 'normal',
		plannedReps,
		weight: null,
		reps: null,
		rpe: null,
		completed: false
	}));

const entry = (n: number, key: string, exerciseId: string, sets: WorkoutSet[]): WorkoutEntry => ({
	id: `entry-${n}`,
	exercises: [{ id: `we-${key}`, exerciseId, sets }]
});

/**
 * A fresh copy every call. The screen mutates this tree in place, so handing
 * out a shared object would let one run leak into the next and quietly ruin the
 * second half of a comparison.
 *
 * `startedAt` is stamped by the caller rather than read here, so the module has
 * no clock of its own and the session is genuinely identical every time.
 */
export function freshWorkout(startedAt: number): Workout {
	return {
		id: 'fixture-workout',
		templateId: null,
		startedAt,
		entries: [
			entry(1, 'bench', 'bench-press', [
				{
					id: 'bench-w',
					type: 'warmup',
					plannedReps: null,
					weight: 40,
					reps: 10,
					rpe: null,
					completed: true
				},
				...working('bench', 4, 8)
			]),
			entry(2, 'incline', 'incline-dumbbell-press', working('incline', 3, null)),
			entry(3, 'fly', 'cable-fly', working('fly', 3, 12)),
			entry(4, 'pecdeck', 'pec-deck', working('pecdeck', 3, 10))
		]
	};
}
