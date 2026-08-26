import { catalogById } from '$lib/catalog';
import { isExertion } from '$lib/domain/exertion';
import { historyKey } from '$lib/domain/grip';
import type { PastSession } from '$lib/domain/stats';
import { rawPr } from '$lib/domain/stats';
import type { History, PerformedSet, Workout } from '$lib/domain/workout';

export type FinishedWorkout = Workout & { finishedAt: number };

/**
 * One logged set, filed twice.
 *
 * `base` is the catalog slug and `key` the slug plus the grip it was performed with — the same
 * string whenever the grip is the exercise's default. Everything downstream picks the one it
 * means: a hint wants the grip that is about to be repeated, and a shelf of what was trained
 * lately wants the exercise, whichever handle was on the cable.
 */
type Logged = { base: string; key: string; set: PerformedSet };

function loggedIn(workout: Workout): Logged[] {
	const out: Logged[] = [];

	for (const entry of workout.entries) {
		for (const exercise of entry.exercises) {
			const meta = catalogById[exercise.exerciseId];

			for (const set of exercise.sets) {
				if (set.completed && set.type !== 'warmup' && set.weight !== null && set.reps !== null) {
					out.push({
						base: exercise.exerciseId,
						key: historyKey(exercise.exerciseId, meta, set.grip),
						set: {
							weight: set.weight,
							reps: set.reps,
							rpe: isExertion(set.rpe) ? set.rpe : null
						}
					});
				}
			}
		}
	}

	return out;
}

export function performedSets(workout: Workout, exerciseId: string): PerformedSet[] {
	return loggedIn(workout)
		.filter((logged) => logged.base === exerciseId)
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

function group(
	workouts: FinishedWorkout[],
	keyOf: (logged: Logged) => string
): Record<string, PastSession[]> {
	const out: Record<string, PastSession[]> = {};

	for (const workout of workouts.toSorted((a, b) => a.startedAt - b.startedAt)) {
		const positions = positionsIn(workout);
		const sessions = new Map<string, PastSession>();

		for (const logged of loggedIn(workout)) {
			const key = keyOf(logged);
			const open = sessions.get(key) ?? {
				date: workout.startedAt,
				workoutId: workout.id,
				position: positions[logged.base],
				sets: []
			};

			open.sets.push(logged.set);
			sessions.set(key, open);
		}

		for (const [key, session] of sessions) {
			(out[key] ??= []).push(session);
		}
	}

	return out;
}

/** Keyed by catalog slug: recency, frequency and everything that aggregates across grips. */
export function sessionsByExercise(workouts: FinishedWorkout[]): Record<string, PastSession[]> {
	return group(workouts, (logged) => logged.base);
}

/** Keyed by slug and grip: hints, and the exercise screen's own best and trend. */
export function sessionsByKey(workouts: FinishedWorkout[]): Record<string, PastSession[]> {
	return group(workouts, (logged) => logged.key);
}

export function pastSessionsFrom(workouts: FinishedWorkout[], exerciseId: string): PastSession[] {
	return sessionsByExercise(workouts)[exerciseId] ?? [];
}

/** Every grip's history for one exercise, the default's under the bare slug. */
export function gripSessionsFrom(
	workouts: FinishedWorkout[],
	exerciseId: string
): Record<string, PastSession[]> {
	const prefix = `${exerciseId}#`;

	return Object.fromEntries(
		Object.entries(sessionsByKey(workouts)).filter(
			([key]) => key === exerciseId || key.startsWith(prefix)
		)
	);
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
 * Last time's sets, per exercise and grip — what the logging card recalls.
 *
 * Grip-keyed where `lastPerformed` is not: a hint is a promise about the set in front of you,
 * and a rope's numbers offered for a bar set is the hint lying.
 */
export function historyFrom(workouts: FinishedWorkout[]): History {
	return Object.fromEntries(
		Object.entries(sessionsByKey(workouts)).flatMap(([key, sessions]) => {
			const last = sessions.at(-1);

			return last === undefined ? [] : [[key, last.sets]];
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
		const trained = new Set(loggedIn(workout).map((logged) => logged.base));

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
