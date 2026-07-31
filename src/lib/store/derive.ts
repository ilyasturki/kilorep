/**
 * What stored workouts mean: the hint map and the per-exercise session lists,
 * derived on read and never stored. One source of truth — the workout records
 * — so history cannot drift from the sessions it summarises, which is the same
 * reason the fixture derived its hint map instead of authoring it twice.
 */

import type { PastSession } from '$lib/domain/stats';
import type { History, PerformedSet, Workout } from '$lib/domain/workout';

/**
 * The payload of a `workout` sync record: the domain tree as the session left
 * it, stamped with when it ended. `finishedAt` lives here and not on the
 * domain type because a workout in flight has no end yet — the domain never
 * sees one, and the store never holds one without.
 */
export type FinishedWorkout = Workout & { finishedAt: number };

/**
 * The sets of one exercise that count, in session order: completed working
 * sets only. Warmups never count and uncompleted sets never count — CLAUDE.md
 * states it as the volume rule, and the hint index math in
 * `$lib/domain/workout` depends on the same filtering, because last time's
 * "working set 2" must mean what this session's does.
 *
 * Flattened across the whole workout: an exercise performed twice in one
 * session is two groups on screen but one history — the sets were all lifted
 * that day, in that order.
 */
export function performedSets(workout: Workout, exerciseId: string): PerformedSet[] {
	const out: PerformedSet[] = [];

	for (const entry of workout.entries) {
		for (const exercise of entry.exercises) {
			if (exercise.exerciseId !== exerciseId) {
				continue;
			}

			for (const set of exercise.sets) {
				// `weight`/`reps` are non-null on every completed set `commitSet`
				// wrote, but the type cannot say so; checked rather than asserted,
				// because these records also arrive from other devices over sync.
				if (set.completed && set.type !== 'warmup' && set.weight !== null && set.reps !== null) {
					out.push({ weight: set.weight, reps: set.reps });
				}
			}
		}
	}

	return out;
}

/** Every catalog exercise a workout holds, each once, in session order. */
function exercisesIn(workout: Workout): string[] {
	const seen = new Set<string>();

	for (const entry of workout.entries) {
		for (const exercise of entry.exercises) {
			seen.add(exercise.exerciseId);
		}
	}

	return [...seen];
}

/**
 * One exercise's past, oldest first — the shape the exercise detail renders.
 * A workout where the exercise was present but nothing was completed
 * contributes no session: nothing was performed, and a row of zero sets would
 * draw as a workout that did not happen.
 */
export function pastSessionsFrom(workouts: FinishedWorkout[], exerciseId: string): PastSession[] {
	const sorted = workouts.toSorted((a, b) => a.startedAt - b.startedAt);
	const out: PastSession[] = [];

	for (const workout of sorted) {
		const sets = performedSets(workout, exerciseId);

		if (sets.length > 0) {
			out.push({ date: workout.startedAt, sets });
		}
	}

	return out;
}

/**
 * The hint map: for every exercise ever performed, the working sets of the
 * last workout that performed it. Walked oldest to newest with later workouts
 * overwriting, so "last time" is literal; an exercise nothing has completed is
 * absent rather than empty, which is the shape `hintFor` reads as "never
 * performed".
 */
export function historyFrom(workouts: FinishedWorkout[]): History {
	const sorted = workouts.toSorted((a, b) => a.startedAt - b.startedAt);
	const out: History = {};

	for (const workout of sorted) {
		for (const exerciseId of exercisesIn(workout)) {
			const sets = performedSets(workout, exerciseId);

			if (sets.length > 0) {
				out[exerciseId] = sets;
			}
		}
	}

	return out;
}
