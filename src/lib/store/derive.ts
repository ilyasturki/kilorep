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
			out.push({
				date: workout.startedAt,
				workoutId: workout.id,
				position: exercisesIn(workout).indexOf(exerciseId) + 1,
				sets
			});
		}
	}

	return out;
}

/**
 * Every exercise's past in one walk — the Dashboard's read, which needs all
 * of them at once where the exercise detail needs one. Entry by entry it is
 * exactly what `pastSessionsFrom` returns for that exercise: sessions oldest
 * first, a workout where nothing was completed contributing none.
 */
export function sessionsByExercise(workouts: FinishedWorkout[]): Record<string, PastSession[]> {
	const sorted = workouts.toSorted((a, b) => a.startedAt - b.startedAt);
	const out: Record<string, PastSession[]> = {};

	for (const workout of sorted) {
		for (const [index, exerciseId] of exercisesIn(workout).entries()) {
			const sets = performedSets(workout, exerciseId);

			if (sets.length > 0) {
				(out[exerciseId] ??= []).push({
					date: workout.startedAt,
					workoutId: workout.id,
					position: index + 1,
					sets
				});
			}
		}
	}

	return out;
}

/**
 * For every exercise ever performed, its last session — the working sets, and
 * the day they were lifted. `PastSession` rather than a shape of its own: it
 * is one entry of what `pastSessionsFrom` returns, and the catalog rows that
 * read this render the same two facts the detail's history list does.
 *
 * Walked oldest to newest with later workouts overwriting, so "last" is
 * literal; an exercise nothing has completed is absent rather than empty,
 * which is the shape `hintFor` reads as "never performed".
 */
export type LastPerformed = Record<string, PastSession | undefined>;

export function lastPerformedFrom(workouts: FinishedWorkout[]): LastPerformed {
	const sorted = workouts.toSorted((a, b) => a.startedAt - b.startedAt);
	const out: LastPerformed = {};

	for (const workout of sorted) {
		for (const [index, exerciseId] of exercisesIn(workout).entries()) {
			const sets = performedSets(workout, exerciseId);

			if (sets.length > 0) {
				out[exerciseId] = {
					date: workout.startedAt,
					workoutId: workout.id,
					position: index + 1,
					sets
				};
			}
		}
	}

	return out;
}

/**
 * The hint map the workout screen prefills from: the same last sessions with
 * the date dropped. A projection rather than its own walk, so a screen holding
 * both — the workout page, whose insert sheet lists the catalog — pays for one
 * pass over the records, and so the hint can never disagree with the row that
 * claims to show the same set.
 */
export function hintsOf(last: LastPerformed): History {
	const out: History = {};

	for (const [exerciseId, session] of Object.entries(last)) {
		if (session !== undefined) {
			out[exerciseId] = session.sets;
		}
	}

	return out;
}

export function historyFrom(workouts: FinishedWorkout[]): History {
	return hintsOf(lastPerformedFrom(workouts));
}

/**
 * How many finished workouts back the shelf below looks.
 *
 * A count of sessions rather than a calendar window, which was the other
 * candidate. A window in weeks measures the calendar, and what the shelf is
 * actually asking is "what do you train" — so a fortnight away from the gym
 * would blank it for someone whose routine had not changed at all, and someone
 * training five times a week would be judged on the same span as someone
 * training twice. Ten is roughly a training block either way: long enough that
 * an upper/lower split shows both halves, short enough that a movement dropped
 * two months ago has fallen out.
 */
const RECENT_SESSIONS = 10;

/** As many as the picker shelves before the muscle sections start. */
const SHELF = 8;

/**
 * The exercises trained most across the recent sessions, most-trained first —
 * what the insert picker pins above the catalog.
 *
 * Counted in *sessions*, never in sets: an exercise is on the shelf because it
 * keeps coming back, and counting sets would let one twelve-set arm day
 * outrank the squat trained every week. Which is also why an exercise
 * performed twice in one workout counts once — `exercisesIn` already dedupes,
 * and the second appearance is one session's shape, not a second session.
 *
 * "Performed" means what it means everywhere else in this module: a workout
 * where the exercise was on screen but nothing was completed contributes
 * nothing. A row this shelf carries is a claim about training done, and the
 * whole point of the tie-break below is that the claim can be trusted.
 *
 * Ties go to the more recent, so a rotation that has just changed sorts ahead
 * of the one it replaced while both still count the same. Below that the order
 * is the sessions' own, which is stable across reads — nothing here consults a
 * clock.
 *
 * Ids rather than exercises, because this module knows nothing of the catalog
 * and should not start now: the sheet joins them, and drops any it cannot
 * resolve.
 */
export function frequentFrom(workouts: FinishedWorkout[], limit: number = SHELF): string[] {
	const recent = workouts.toSorted((a, b) => b.startedAt - a.startedAt).slice(0, RECENT_SESSIONS);
	const counts = new Map<string, { sessions: number; last: number }>();

	for (const workout of recent) {
		for (const exerciseId of exercisesIn(workout)) {
			if (performedSets(workout, exerciseId).length === 0) {
				continue;
			}

			const seen = counts.get(exerciseId);

			if (seen === undefined) {
				counts.set(exerciseId, { sessions: 1, last: workout.startedAt });
			} else {
				seen.sessions += 1;
				seen.last = Math.max(seen.last, workout.startedAt);
			}
		}
	}

	return [...counts]
		.toSorted(([, a], [, b]) => b.sessions - a.sessions || b.last - a.last)
		.slice(0, limit)
		.map(([exerciseId]) => exerciseId);
}
