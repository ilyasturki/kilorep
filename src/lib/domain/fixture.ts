/**
 * The scripted session the workout domain's tests are judged against.
 *
 * Test-only since the store landed — the screens read real records now, and
 * nothing under `routes/` may import this file again. It stays because the
 * fourteen sets encode the four states the header below describes, and the
 * tests name their nodes directly.
 *
 * Exercises are real catalog slugs now — the screens join through
 * `catalogById` like they will against the store — but the *node* ids stay on
 * the old short scheme (`entry-1`, `we-bench`, `bench-1`) because the tests
 * name sets directly and the scheme is theirs.
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

import type { PastSession } from '$lib/domain/stats';
import type { History, Workout, WorkoutEntry, WorkoutSet } from '$lib/domain/workout';

const session = (date: number, sets: [number, number][]): PastSession => ({
	date,
	sets: sets.map(([weight, reps]) => ({ weight, reps }))
});

/**
 * Weeks of past sessions, oldest first, enough for the detail screen to have
 * something honest-shaped to draw. The decay across each list is deliberate —
 * 80 × 8, 80 × 8, 80 × 7, 77.5 × 7 is what a real fourth set looks like, and a
 * flat list would hide an off-by-one in the hint lookup by making every index
 * interchangeable. Bench's raw PR (82.5 × 3) sits two sessions back, not in
 * the last one, so "best" and "last time" render as different numbers.
 *
 * `pec-deck` is absent, not empty. That is the point of it.
 */
export const pastSessions: Record<string, PastSession[]> = {
	'bench-press': [
		session(Date.UTC(2026, 5, 15), [
			[75, 8],
			[75, 8],
			[75, 6],
			[72.5, 8]
		]),
		session(Date.UTC(2026, 5, 22), [
			[77.5, 8],
			[77.5, 7],
			[77.5, 6],
			[75, 8]
		]),
		session(Date.UTC(2026, 5, 29), [
			[82.5, 3],
			[80, 6],
			[77.5, 8]
		]),
		session(Date.UTC(2026, 6, 6), [
			[80, 8],
			[80, 7],
			[80, 6],
			[77.5, 8]
		]),
		session(Date.UTC(2026, 6, 13), [
			[80, 8],
			[80, 8],
			[80, 7],
			[77.5, 7]
		])
	],
	'incline-dumbbell-press': [
		session(Date.UTC(2026, 5, 24), [
			[27.5, 10],
			[27.5, 9],
			[25, 10]
		]),
		session(Date.UTC(2026, 6, 1), [
			[30, 8],
			[27.5, 10],
			[27.5, 9]
		]),
		session(Date.UTC(2026, 6, 8), [
			[30, 9],
			[30, 8],
			[27.5, 10]
		]),
		session(Date.UTC(2026, 6, 15), [
			[30, 10],
			[30, 9],
			[27.5, 9]
		])
	],
	'cable-fly': [
		session(Date.UTC(2026, 6, 1), [
			[17.5, 12],
			[17.5, 12],
			[17.5, 11]
		]),
		session(Date.UTC(2026, 6, 8), [
			[20, 11],
			[20, 10],
			[17.5, 12]
		]),
		session(Date.UTC(2026, 6, 15), [
			[20, 12],
			[20, 12],
			[20, 10]
		])
	]
};

/**
 * The hint map, derived rather than authored twice: the hint *is* the last
 * past session, and two copies of the same sets would drift the first time a
 * session is edited above.
 */
export const history: History = Object.fromEntries(
	Object.entries(pastSessions).flatMap(([id, sessions]) => {
		const last = sessions.at(-1);

		// An empty session list would be authored nonsense; absent from the
		// hint map is the honest reading of it, not an empty entry.
		return last === undefined ? [] : [[id, last.sets]];
	})
);

// Two factories rather than a hundred and sixty lines of identical literals,
// so that the four cases the header describes are legible in the four lines
// that build them. The short key names the tree's nodes; the slug is what the
// exercise *is*.
const working = (key: string, count: number, plannedReps: number | null): WorkoutSet[] =>
	Array.from({ length: count }, (_, i) => ({
		id: `${key}-${i + 1}`,
		type: 'normal',
		plannedReps,
		weight: null,
		reps: null,
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
		startedAt,
		entries: [
			entry(1, 'bench', 'bench-press', [
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
			entry(2, 'incline', 'incline-dumbbell-press', working('incline', 3, null)),
			entry(3, 'fly', 'cable-fly', working('fly', 3, 12)),
			entry(4, 'pecdeck', 'pec-deck', working('pecdeck', 3, 10))
		]
	};
}
