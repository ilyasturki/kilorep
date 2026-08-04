import type { Exercise, Muscle } from '$lib/domain/exercise';
import { loadFactor, MUSCLES } from '$lib/domain/exercise';
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

export type Consistency = {
	thisWeek: number;
	habit: number | null;
	weeks: number[];
};

export function consistency(startedAts: number[], now: Date, weeks = 8): Consistency {
	const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

	const boundaries: number[] = [monday.getTime()];

	for (let k = 1; k <= weeks; k++) {
		monday.setDate(monday.getDate() - 7);
		boundaries.push(monday.getTime());
	}

	const thisWeek = startedAts.filter((at) => at >= boundaries[0]).length;

	const first = startedAts.length === 0 ? null : Math.min(...startedAts);
	const counts: number[] = [];

	for (let k = 1; k <= weeks; k++) {
		if (first !== null && boundaries[k - 1] > first) {
			counts.push(startedAts.filter((at) => at >= boundaries[k] && at < boundaries[k - 1]).length);
		}
	}

	const sorted = counts.toSorted((a, b) => a - b);
	let habit: number | null = null;

	if (sorted.length > 0) {
		const mid = Math.floor(sorted.length / 2);

		habit = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
	}

	return { thisWeek, habit, weeks: counts.toReversed() };
}

function completedVolume(sets: WorkoutSet[], factor: number): number {
	let volume = 0;

	for (const set of sets) {
		if (set.completed && set.type !== 'warmup' && set.weight !== null && set.reps !== null) {
			volume += set.weight * set.reps * factor;
		}
	}

	return volume;
}

export function muscleVolume(
	workouts: Workout[],
	since: number,
	exerciseOf: (exerciseId: string) => Exercise | undefined
): { muscle: Muscle; kg: number }[] {
	const totals = new Map<Muscle, number>();

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

				const primary = known.muscles.primary;
				const gained = completedVolume(exercise.sets, loadFactor(known.loadMode));

				totals.set(primary, (totals.get(primary) ?? 0) + gained);
			}
		}
	}

	return MUSCLES.map((muscle) => ({ muscle, kg: totals.get(muscle) ?? 0 }));
}
