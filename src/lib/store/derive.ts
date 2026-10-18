import { catalogById } from '$lib/catalog';
import { isExertion } from '$lib/domain/exertion';
import { settleGrip } from '$lib/domain/grip';
import type { PastSession } from '$lib/domain/stats';
import { rawPr } from '$lib/domain/stats';
import type { Exercise } from '$lib/domain/exercise';
import type { History, PerformedSet, Workout, WorkoutSet } from '$lib/domain/workout';

export type FinishedWorkout = Workout & { finishedAt: number };

/**
 * One logged set, under the exercise it was performed on.
 *
 * The grip rides on the set rather than in the key: a pull-up is one movement whichever way the
 * hands faced, so everything here answers for the exercise, and a view that wants one grip
 * narrows the sets it was handed.
 */
type Logged = { exerciseId: string; set: PerformedSet };

/** A completed working set as history reads it, or null for anything else. */
function performedOf(set: WorkoutSet, meta: Exercise | undefined): PerformedSet | null {
	if (!set.completed || set.type === 'warmup' || set.weight === null || set.reps === null) {
		return null;
	}

	const out: PerformedSet = {
		weight: set.weight,
		reps: set.reps,
		rpe: isExertion(set.rpe) ? set.rpe : null
	};

	const grip = settleGrip(meta, set.grip);

	if (grip !== undefined) {
		out.grip = grip;
	}

	return out;
}

function loggedIn(workout: Workout): Logged[] {
	const out: Logged[] = [];

	for (const entry of workout.entries) {
		for (const exercise of entry.exercises) {
			const meta = catalogById[exercise.exerciseId];

			for (const set of exercise.sets) {
				const done = performedOf(set, meta);

				if (done !== null) {
					out.push({ exerciseId: exercise.exerciseId, set: done });
				}
			}
		}
	}

	return out;
}

export function performedSets(workout: Workout, exerciseId: string): PerformedSet[] {
	return loggedIn(workout)
		.filter((logged) => logged.exerciseId === exerciseId)
		.map((logged) => logged.set);
}

function exercisesIn(workout: Workout): string[] {
	return [...new Set(workout.entries.flatMap((entry) => entry.exercises.map((e) => e.exerciseId)))];
}

/**
 * Where each exercise fell in the session, counted over exercises rather than grips.
 *
 * A rope pushdown and a bar pushdown in the same session are both the fourth exercise. They
 * were one trip to one cable; numbering them fourth and fifth would describe a session that
 * did not happen.
 */
function positionsIn(workout: Workout): Record<string, number> {
	return Object.fromEntries(exercisesIn(workout).map((id, index) => [id, index + 1]));
}

export function sessionsByExercise(workouts: FinishedWorkout[]): Record<string, PastSession[]> {
	const out: Record<string, PastSession[]> = {};

	for (const workout of workouts.toSorted((a, b) => a.startedAt - b.startedAt)) {
		const positions = positionsIn(workout);
		const sessions = new Map<string, PastSession>();

		for (const logged of loggedIn(workout)) {
			const open = sessions.get(logged.exerciseId) ?? {
				date: workout.startedAt,
				workoutId: workout.id,
				position: positions[logged.exerciseId],
				sets: []
			};

			open.sets.push(logged.set);
			sessions.set(logged.exerciseId, open);
		}

		for (const [exerciseId, session] of sessions) {
			(out[exerciseId] ??= []).push(session);
		}
	}

	return out;
}

export function pastSessionsFrom(workouts: FinishedWorkout[], exerciseId: string): PastSession[] {
	return sessionsByExercise(workouts)[exerciseId] ?? [];
}

/**
 * One grip's share of an exercise's history: the sets performed with it, in the sessions that
 * had any.
 *
 * The sets are the same objects, never copies — a best found in the narrowed list is matched
 * back against the rows by identity.
 */
export function narrowTo(sessions: PastSession[], grip: string): PastSession[] {
	return sessions.flatMap((session) => {
		const sets = session.sets.filter((set) => set.grip === grip);

		return sets.length === 0
			? []
			: [{ date: session.date, workoutId: session.workoutId, position: session.position, sets }];
	});
}

export type LastPerformed = Record<string, PastSession | undefined>;

export function lastPerformedFrom(workouts: FinishedWorkout[]): LastPerformed {
	return Object.fromEntries(
		Object.entries(sessionsByExercise(workouts)).map(([id, sessions]) => [id, sessions.at(-1)])
	);
}

export type Heaviest = Record<string, PerformedSet | undefined>;

/**
 * The best set ever logged per exercise. Zero body weight carried (`() => 0`) on purpose —
 * the weigh-in shifts what a set moved, never which set ranks first, and a ledger column has
 * no weigh-in to hand.
 */
export function heaviestFrom(workouts: FinishedWorkout[]): Heaviest {
	return Object.fromEntries(
		Object.entries(sessionsByExercise(workouts)).map(([id, sessions]) => {
			const best = rawPr(sessions, () => 0);

			return [id, best === null ? undefined : best.set];
		})
	);
}

/**
 * Last time's sets, per exercise — what the logging card recalls, whatever the grip. Each set
 * keeps the grip it was performed with, so the card can say so when today's differs.
 */
export function historyFrom(workouts: FinishedWorkout[]): History {
	return Object.fromEntries(
		Object.entries(sessionsByExercise(workouts)).flatMap(([exerciseId, sessions]) => {
			const last = sessions.at(-1);

			return last === undefined ? [] : [[exerciseId, last.sets]];
		})
	);
}

/**
 * The grip each exercise was last worked with.
 *
 * An exercise added mid-session opens on this rather than on the catalog default: the gym has
 * one rope on the pushdown station and reaching for it every session is not a preference worth
 * restating. Absent means nothing has been logged yet, and the catalog default stands.
 */
export type LastGrips = Record<string, string | undefined>;

export function lastGripsFrom(workouts: FinishedWorkout[]): LastGrips {
	const out: LastGrips = {};

	for (const workout of workouts.toSorted((a, b) => a.startedAt - b.startedAt)) {
		for (const entry of workout.entries) {
			for (const exercise of entry.exercises) {
				if (exercise.sets.some((set) => set.completed && set.type !== 'warmup')) {
					out[exercise.exerciseId] = exercise.grip;
				}
			}
		}
	}

	return out;
}

const RECENT_SESSIONS = 10;

const SHELF = 8;

export function frequentFrom(workouts: FinishedWorkout[], limit: number = SHELF): string[] {
	const recent = workouts.toSorted((a, b) => b.startedAt - a.startedAt).slice(0, RECENT_SESSIONS);
	const counts = new Map<string, { sessions: number; last: number }>();

	for (const workout of recent) {
		const trained = new Set(loggedIn(workout).map((logged) => logged.exerciseId));

		for (const exerciseId of trained) {
			const seen = counts.get(exerciseId) ?? { sessions: 0, last: workout.startedAt };

			seen.sessions += 1;
			seen.last = Math.max(seen.last, workout.startedAt);
			counts.set(exerciseId, seen);
		}
	}

	return [...counts]
		.toSorted(([, a], [, b]) => b.sessions - a.sessions || b.last - a.last)
		.slice(0, limit)
		.map(([exerciseId]) => exerciseId);
}
