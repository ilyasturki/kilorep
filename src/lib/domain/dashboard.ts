/**
 * The Dashboard's standing questions, as math. PRODUCT.md fixes the screen to
 * four cards — Progressing? · Consistent? · Balanced? · Weight on track? —
 * and each card's derivation lives here, framework-free per CLAUDE.md hard
 * rule 1. The fourth card has no function of its own: it is `rollingAverage`
 * and `weeklyRate`, which belong to `$lib/domain/bodyweight`.
 *
 * "No configuration" is the screen's rule, so every input a card could have
 * asked the user for is derived instead — the main lifts from what was
 * actually trained, the habit from the log's own weeks. The windows (four
 * weeks back for PRs and balance, twelve for main lifts, eight for the habit)
 * are parameters with defaults rather than constants, so a test can pin them
 * and the phone can tune them; the user never sees them.
 */

import type { Exercise, Muscle } from '$lib/domain/exercise';
import { loadFactor, MUSCLES } from '$lib/domain/exercise';
import type { PastSession } from '$lib/domain/stats';
import { estimated1Rm, rawPr } from '$lib/domain/stats';
import type { PerformedSet, Workout, WorkoutSet } from '$lib/domain/workout';

/**
 * A raw PR set inside the window — the Progressing card's headline rows,
 * newest first, one per exercise.
 *
 * `rawPr` is the arbiter, so its rules ride along: the first achievement
 * holds a tie, which is what keeps a PR merely *matched* in the window from
 * reappearing as news. One extra gate — the PR must not come from the
 * exercise's first-ever session. A first outing sets a best by definition,
 * and a card that congratulates every exercise a new program introduces would
 * read as noise in exactly the week it changes.
 */
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

/**
 * The main lifts, derived rather than configured: the exercises trained most
 * inside the window — ranked by session count, ties settled by the volume
 * lifted in those sessions, which is what "main" means when the counts agree.
 * Most-trained first, at most `count`.
 *
 * Two sessions minimum, because the card's question about these is
 * *direction* and one point has none. `loadFactorOf` resolves an exercise's
 * volume multiplier — the caller has the catalog; this module does not.
 */
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
		let volume = 0;

		for (const session of recent) {
			for (const set of session.sets) {
				volume += set.weight * set.reps * factor;
			}
		}

		ranked.push({ exerciseId, trained: recent.length, volume });
	}

	return ranked
		.toSorted((a, b) => b.trained - a.trained || b.volume - a.volume)
		.slice(0, count)
		.map((lift) => lift.exerciseId);
}

/**
 * The est-1RM series a Progressing row sparks: one point per session in the
 * window, valued at the session's best Epley estimate. Oldest first, the
 * order sessions arrive in. A bodyweight zero estimates nothing and
 * contributes no point — a trend of zeros would be a flat line about nothing.
 */
export type TrendPoint = { date: number; est: number };

export function estTrend(past: PastSession[], since: number): TrendPoint[] {
	const out: TrendPoint[] = [];

	for (const session of past) {
		if (session.date < since) {
			continue;
		}

		let best = 0;

		for (const set of session.sets) {
			best = Math.max(best, estimated1Rm(set));
		}

		if (best > 0) {
			out.push({ date: session.date, est: best });
		}
	}

	return out;
}

/**
 * Sessions this week against the habit — facts, never streaks, per
 * PRODUCT.md.
 *
 * The week is the person's: Monday-started, in local time, which is why this
 * walks the local calendar with `setDate` rather than dividing UTC epoch days
 * — a DST week is 167 or 169 hours long and still one week.
 *
 * The habit is the median over the trailing `weeks` *full* weeks — the
 * current one excluded, or every Monday would read as a lapse — and only the
 * weeks the log has existed for: a week before the first session ever counts
 * for nothing, not for zero, so three weeks of history compare against three
 * weeks of habit rather than against five empty ones. Median over mean so one
 * holiday or one doubled week does not move the answer. Null when no full
 * week of history exists yet: there is no habit to compare against, and the
 * card says so instead of inventing one.
 */
export type Consistency = {
	/** Completed sessions since Monday, the running week. */
	thisWeek: number;
	/** Median sessions per full week, or null before the log's first full week. */
	habit: number | null;
	/** The counted full weeks, oldest first — the card's bars. */
	weeks: number[];
};

export function consistency(startedAts: number[], now: Date, weeks = 8): Consistency {
	const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

	// boundaries[k] is the Monday k weeks back; week k spans
	// [boundaries[k], boundaries[k-1]).
	const boundaries: number[] = [monday.getTime()];

	for (let k = 1; k <= weeks; k++) {
		monday.setDate(monday.getDate() - 7);
		boundaries.push(monday.getTime());
	}

	const thisWeek = startedAts.filter((at) => at >= boundaries[0]).length;

	const first = startedAts.length === 0 ? null : Math.min(...startedAts);
	const counts: number[] = [];

	for (let k = 1; k <= weeks; k++) {
		// The week counts once the log reaches into it: it ends after the first
		// session happened.
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

	// Counts were built newest full week first; the card's bars read oldest first.
	return { thisWeek, habit, weeks: counts.toReversed() };
}

/**
 * Working volume by muscle over the window — the Balanced? card, every
 * muscle, zeros included: a neglected muscle at zero *is* the answer the
 * question exists for. Rows come back in `MUSCLES` order, top of the body to
 * bottom, the same shelving the browse screen uses.
 *
 * Attribution is to the primary muscle alone — the rule `MuscleTargets` left
 * open until this card was built. Primaries match how lifters file the
 * exercise, and they keep every total a sum of real kilograms; weighting
 * secondaries would smooth the picture with a multiplier nobody can defend,
 * and at eleven coarse groups the smoothing is what hides the neglect.
 *
 * Completed working sets only, ×2 for per-hand and unilateral — CLAUDE.md's
 * volume rule. An exercise the resolver cannot name is skipped whole: a
 * custom from a future device, whose muscles nothing here knows.
 */
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
