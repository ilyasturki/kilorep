import type { Exercise, Muscle } from '$lib/domain/exercise';
import { MUSCLES } from '$lib/domain/exercise';
import type { PastSession } from '$lib/domain/stats';
import { estimated1Rm, rawPr } from '$lib/domain/stats';
import type { PerformedSet, Workout, WorkoutSet } from '$lib/domain/workout';

export type RecentPr = { exerciseId: string; set: PerformedSet; date: number };

export function recentPrs(sessions: Record<string, PastSession[]>, since: number): RecentPr[] {
	const out: RecentPr[] = [];

	for (const [exerciseId, past] of Object.entries(sessions)) {
		const pr = rawPr(past);

		if (pr !== null && pr.date >= since && past[0].date < pr.date) {
			out.push({ exerciseId, set: pr.set, date: pr.date });
		}
	}

	return out.toSorted((a, b) => b.date - a.date);
}

export function mainLifts(
	sessions: Record<string, PastSession[]>,
	since: number,
	loadFactorOf: (exerciseId: string) => number,
	count = 3
): string[] {
	const ranked: { exerciseId: string; trained: number; volume: number }[] = [];

	for (const [exerciseId, past] of Object.entries(sessions)) {
		const recent = past.filter((session) => session.date >= since);

		if (recent.length < 2) {
			continue;
		}

		const factor = loadFactorOf(exerciseId);
		const volume = recent
			.flatMap((session) => session.sets)
			.reduce((sum, set) => sum + set.weight * set.reps * factor, 0);

		ranked.push({ exerciseId, trained: recent.length, volume });
	}

	return ranked
		.toSorted((a, b) => b.trained - a.trained || b.volume - a.volume)
		.slice(0, count)
		.map((lift) => lift.exerciseId);
}

export type TrendPoint = { date: number; est: number };

export function estTrend(past: PastSession[], since: number): TrendPoint[] {
	return past
		.filter((session) => session.date >= since)
		.map((session) => ({
			date: session.date,
			est: Math.max(0, ...session.sets.map((set) => estimated1Rm(set)))
		}))
		.filter((point) => point.est > 0);
}

export const WEEK = 7 * 86_400_000;

/**
 * The set of sets every figure on the screen is counted from: completed,
 * working, and carrying both numbers. Warmups never count and uncompleted sets
 * never count — PRODUCT.md's rule, applied once here so tonnage and set count
 * can never disagree about what a set is.
 */
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

/**
 * Tonnage and working sets in each of the trailing seven-day windows, oldest
 * first — the last bucket ending at `now`, not on a Sunday.
 *
 * Rolling and not calendar, which is the whole point: a Monday-anchored chart
 * ends on a bucket that is one to seven days old and draws it beside buckets
 * that are seven, so the trailing bar always slopes down and the slope means
 * nothing. Every bucket here is a full week wide, so any two are comparable and
 * the last one is a fact about the last seven days rather than about what day
 * it happens to be.
 */
export function weeklyWork(
	workouts: Workout[],
	now: number,
	loadFactorOf: (exerciseId: string) => number,
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

		// Clamped rather than skipped: a session logged a moment ago rounds into
		// the bucket after the last one on any clock that has drifted forward.
		const bucket = Math.min(weeks - 1, Math.floor((workout.startedAt - oldest) / WEEK));

		for (const entry of workout.entries) {
			for (const exercise of entry.exercises) {
				const factor = loadFactorOf(exercise.exerciseId);

				for (const set of workingSets(exercise.sets)) {
					out[bucket].kg += set.weight * set.reps * factor;
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

/**
 * Sessions in the last seven days, against the median of the seven-day windows
 * before it — the same rolling anchor `weeklyWork` uses, and for the same
 * reason. "This week" used to mean since Monday, which on a Tuesday compared a
 * day and a half against eight full weeks and read as a collapse.
 *
 * A window that ended before the log began is not a zero, it is not a week: it
 * counts for nothing and stays out of both the median and the bars, which is
 * why a fresh log has no median rather than a median of none.
 */
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

/**
 * Working sets per muscle, split by how the muscle earned them: the exercise's
 * primary target takes a direct set, each secondary takes an indirect one.
 *
 * Sets and not kilos, because the two are not the same question. Volume in kg
 * is dominated by whatever the heaviest movement in the split is — a squat day
 * buries an arm day under an order of magnitude — so the card that exists to
 * show neglect was answering with load instead. Sets are what a programme is
 * actually written in, and they are also the only unit in which a secondary
 * target can be counted honestly: 55 of the 79 catalog entries carry
 * secondaries, and none of them says what fraction of the bar the muscle took.
 */
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
