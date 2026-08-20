import type { Exercise, Muscle } from '$lib/domain/exercise';
import { MUSCLES } from '$lib/domain/exercise';
import type { Carried, CarriedOn } from '$lib/domain/load';
import { carriedOn } from '$lib/domain/load';
import type { PastSession } from '$lib/domain/stats';
import { estimated1Rm, rawPr } from '$lib/domain/stats';
import type { PerformedSet, Workout, WorkoutSet } from '$lib/domain/workout';

export type RecentPr = { exerciseId: string; set: PerformedSet; date: number; load: number };

export function recentPrs(
	sessions: Record<string, PastSession[]>,
	since: number,
	carried: Carried
): RecentPr[] {
	const out: RecentPr[] = [];

	for (const [exerciseId, past] of Object.entries(sessions)) {
		const pr = rawPr(past, carriedOn(carried, exerciseId));

		if (pr !== null && pr.date >= since && past[0].date < pr.date) {
			out.push({ exerciseId, set: pr.set, date: pr.date, load: pr.load });
		}
	}

	return out.toSorted((a, b) => b.date - a.date);
}

export function mainLifts(
	sessions: Record<string, PastSession[]>,
	since: number,
	loadFactorOf: (exerciseId: string) => number,
	carried: Carried,
	count = 3
): string[] {
	const ranked: { exerciseId: string; trained: number; volume: number }[] = [];

	for (const [exerciseId, past] of Object.entries(sessions)) {
		const recent = past.filter((session) => session.date >= since);

		if (recent.length < 2) {
			continue;
		}

		const factor = loadFactorOf(exerciseId);
		const volume = recent.reduce((sum, session) => {
			const body = carried(exerciseId, session.date);

			return (
				sum + session.sets.reduce((kg, set) => kg + (set.weight + body) * set.reps * factor, 0)
			);
		}, 0);

		ranked.push({ exerciseId, trained: recent.length, volume });
	}

	return ranked
		.toSorted((a, b) => b.trained - a.trained || b.volume - a.volume)
		.slice(0, count)
		.map((lift) => lift.exerciseId);
}

export type TrendPoint = { date: number; est: number };

export function estTrend(past: PastSession[], since: number, carried: CarriedOn): TrendPoint[] {
	return past
		.filter((session) => session.date >= since)
		.map((session) => ({
			date: session.date,
			est: Math.max(0, ...session.sets.map((set) => estimated1Rm(set, carried(session.date))))
		}))
		.filter((point) => point.est > 0);
}

export const WEEK = 7 * 86_400_000;

function workingSets(sets: WorkoutSet[]): { weight: number; reps: number }[] {
	const out: { weight: number; reps: number }[] = [];

	for (const set of sets) {
		if (set.completed && set.type !== 'warmup' && set.weight !== null && set.reps !== null) {
			out.push({ weight: set.weight, reps: set.reps });
		}
	}

	return out;
}

export type WorkWeek = { start: number; kg: number; sets: number };

export function weeklyWork(
	workouts: Workout[],
	now: number,
	loadFactorOf: (exerciseId: string) => number,
	carried: Carried,
	weeks = 12
): WorkWeek[] {
	const oldest = now - weeks * WEEK;
	const out: WorkWeek[] = [];

	for (let k = 0; k < weeks; k++) {
		out.push({ start: oldest + k * WEEK, kg: 0, sets: 0 });
	}

	for (const workout of workouts) {
		if (workout.startedAt < oldest) {
			continue;
		}

		// Clamped: forward clock drift can round a just-logged session past the last bucket.
		const bucket = Math.min(weeks - 1, Math.floor((workout.startedAt - oldest) / WEEK));

		for (const entry of workout.entries) {
			for (const exercise of entry.exercises) {
				const factor = loadFactorOf(exercise.exerciseId);
				const body = carried(exercise.exerciseId, workout.startedAt);

				for (const set of workingSets(exercise.sets)) {
					out[bucket].kg += (set.weight + body) * set.reps * factor;
					out[bucket].sets += 1;
				}
			}
		}
	}

	return out;
}

export type Consistency = {
	last7: number;
	median: number | null;
	weeks: number[];
};

export function rollingConsistency(startedAts: number[], now: number, weeks = 8): Consistency {
	const within = (from: number, to: number): number =>
		startedAts.filter((at) => at >= from && at < to).length;

	const first = startedAts.length === 0 ? null : Math.min(...startedAts);
	const trailing: number[] = [];

	for (let k = 1; k <= weeks; k++) {
		const to = now - k * WEEK;

		if (first !== null && to > first) {
			trailing.push(within(to - WEEK, to));
		}
	}

	const sorted = trailing.toSorted((a, b) => a - b);
	let median: number | null = null;

	if (sorted.length > 0) {
		const mid = Math.floor(sorted.length / 2);

		median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
	}

	return { last7: within(now - WEEK, now), median, weeks: trailing.toReversed() };
}

export type MuscleSets = { muscle: Muscle; direct: number; indirect: number };

export function muscleSets(
	workouts: Workout[],
	since: number,
	exerciseOf: (exerciseId: string) => Exercise | undefined
): MuscleSets[] {
	const direct = new Map<Muscle, number>();
	const indirect = new Map<Muscle, number>();

	for (const workout of workouts) {
		if (workout.startedAt < since) {
			continue;
		}

		for (const entry of workout.entries) {
			for (const exercise of entry.exercises) {
				const known = exerciseOf(exercise.exerciseId);

				if (known === undefined) {
					continue;
				}

				const count = workingSets(exercise.sets).length;

				if (count === 0) {
					continue;
				}

				const primary = known.muscles.primary;
				direct.set(primary, (direct.get(primary) ?? 0) + count);

				for (const muscle of known.muscles.secondary) {
					indirect.set(muscle, (indirect.get(muscle) ?? 0) + count);
				}
			}
		}
	}

	return MUSCLES.map((muscle) => ({
		muscle,
		direct: direct.get(muscle) ?? 0,
		indirect: indirect.get(muscle) ?? 0
	}));
}
