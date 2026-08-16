import { isExertion } from '$lib/domain/exertion';
import type { PastSession } from '$lib/domain/stats';
import type { History, PerformedSet, Workout } from '$lib/domain/workout';

export type FinishedWorkout = Workout & { finishedAt: number };

export function performedSets(workout: Workout, exerciseId: string): PerformedSet[] {
	const out: PerformedSet[] = [];

	for (const entry of workout.entries) {
		for (const exercise of entry.exercises) {
			if (exercise.exerciseId !== exerciseId) {
				continue;
			}

			for (const set of exercise.sets) {
				if (set.completed && set.type !== 'warmup' && set.weight !== null && set.reps !== null) {
					out.push({
						weight: set.weight,
						reps: set.reps,
						rpe: isExertion(set.rpe) ? set.rpe : null
					});
				}
			}
		}
	}

	return out;
}

function exercisesIn(workout: Workout): string[] {
	return [...new Set(workout.entries.flatMap((entry) => entry.exercises.map((e) => e.exerciseId)))];
}

export function sessionsByExercise(workouts: FinishedWorkout[]): Record<string, PastSession[]> {
	const out: Record<string, PastSession[]> = {};

	for (const workout of workouts.toSorted((a, b) => a.startedAt - b.startedAt)) {
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

export function pastSessionsFrom(workouts: FinishedWorkout[], exerciseId: string): PastSession[] {
	return sessionsByExercise(workouts)[exerciseId] ?? [];
}

export type LastPerformed = Record<string, PastSession | undefined>;

export function lastPerformedFrom(workouts: FinishedWorkout[]): LastPerformed {
	return Object.fromEntries(
		Object.entries(sessionsByExercise(workouts)).map(([id, sessions]) => [id, sessions.at(-1)])
	);
}

export function hintsOf(last: LastPerformed): History {
	return Object.fromEntries(
		Object.entries(last).flatMap(([id, session]) =>
			session === undefined ? [] : [[id, session.sets]]
		)
	);
}

const RECENT_SESSIONS = 10;

const SHELF = 8;

export function frequentFrom(workouts: FinishedWorkout[], limit: number = SHELF): string[] {
	const recent = workouts.toSorted((a, b) => b.startedAt - a.startedAt).slice(0, RECENT_SESSIONS);
	const counts = new Map<string, { sessions: number; last: number }>();

	for (const workout of recent) {
		for (const exerciseId of exercisesIn(workout)) {
			if (performedSets(workout, exerciseId).length === 0) {
				continue;
			}

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
