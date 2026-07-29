/**
 * The scripted session the workout screen is judged against.
 *
 * Fixed rather than random, and fixed rather than persisted, because the build
 * it serves is a comparison: the focused and list containers are run through
 * the same fourteen sets and the same four exercises, and any difference in
 * taps or wall-clock has to be attributable to the container and nothing else.
 * Every reload hands back an identical session, which is what makes a run
 * repeatable.
 *
 * The four exercises are chosen to cover the states, not to be a plausible
 * chest day:
 *
 * - **Bench Press** — a warmup above the working sets, so the hint lookup has
 *   to count past it, and a planned rep target on every set.
 * - **Incline DB Press** — `plannedReps: null`, PRODUCT.md's open target, where
 *   the rep field falls through to the hint.
 * - **Cable Fly** — the ordinary case, planned reps and full history.
 * - **Pec Deck** — *no history at all*: blank fields, inert check. Not an edge
 *   case. There is no v1 import, so hints "stay silent until history rebuilds
 *   naturally" and this is the state every exercise is in for every new user
 *   through their entire first workout.
 */

import type { Exercise, History, Workout, WorkoutEntry, WorkoutSet } from '$lib/domain/workout';

export const exercises: Record<string, Exercise> = {
	bench: { id: 'bench', name: 'Bench Press', equipment: 'Barbell', loadMode: 'total' },
	incline: {
		id: 'incline',
		name: 'Incline DB Press',
		equipment: 'Dumbbell',
		loadMode: 'per-hand'
	},
	fly: { id: 'fly', name: 'Cable Fly', equipment: 'Cable', loadMode: 'total' },
	pecdeck: { id: 'pecdeck', name: 'Pec Deck', equipment: 'Machine', loadMode: 'total' }
};

/**
 * Last session's working sets, in order. The decay across each list is
 * deliberate — a hint that reads 80 × 8, 80 × 8, 80 × 7, 77.5 × 7 is what a
 * real fourth set looks like, and a flat list would hide an off-by-one in the
 * lookup by making every index interchangeable.
 *
 * `pecdeck` is absent, not empty. That is the point of it.
 */
export const history: History = {
	bench: [
		{ weight: 80, reps: 8 },
		{ weight: 80, reps: 8 },
		{ weight: 80, reps: 7 },
		{ weight: 77.5, reps: 7 }
	],
	incline: [
		{ weight: 30, reps: 10 },
		{ weight: 30, reps: 9 },
		{ weight: 27.5, reps: 9 }
	],
	fly: [
		{ weight: 20, reps: 12 },
		{ weight: 20, reps: 12 },
		{ weight: 20, reps: 10 }
	]
};

// Two factories rather than a hundred and sixty lines of identical literals, so
// that the four cases the header describes are legible in the four lines that
// build them. Ids are generated to the same scheme they were written in —
// `entry-1`, `we-bench`, `bench-1` — because the tests name sets directly.
const working = (exerciseId: string, count: number, plannedReps: number | null): WorkoutSet[] =>
	Array.from({ length: count }, (_, i) => ({
		id: `${exerciseId}-${i + 1}`,
		type: 'normal',
		plannedReps,
		weight: null,
		reps: null,
		completed: false
	}));

const entry = (n: number, exerciseId: string, sets: WorkoutSet[]): WorkoutEntry => ({
	id: `entry-${n}`,
	exercises: [{ id: `we-${exerciseId}`, exerciseId, sets }]
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
		startedAt,
		entries: [
			entry(1, 'bench', [
				// Already logged, so the session opens on working set 1 and the warmup
				// is present purely as something to render — and as the off-by-one the
				// hint lookup has to count past.
				{
					id: 'bench-w',
					type: 'warmup',
					plannedReps: null,
					weight: 40,
					reps: 10,
					completed: true
				},
				...working('bench', 4, 8)
			]),
			entry(2, 'incline', working('incline', 3, null)),
			entry(3, 'fly', working('fly', 3, 12)),
			entry(4, 'pecdeck', working('pecdeck', 3, 10))
		]
	};
}
