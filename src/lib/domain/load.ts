import type { BodyweightEntry } from './bodyweight.ts';
import { localDateOf } from './bodyweight.ts';
import type { Exercise } from './exercise.ts';

/** Body weight one exercise carried on the day a session ran, in kg. */
export type Carried = (exerciseId: string, at: number) => number;

/** The same, bound to the one exercise a per-exercise statistic is already about. */
export type CarriedOn = (at: number) => number;

export function carriedOn(carried: Carried, exerciseId: string): CarriedOn {
	return (at) => carried(exerciseId, at);
}

export function bodyweightShareOf(exercise: Exercise | undefined): number {
	return exercise === undefined ? 0 : (exercise.bodyweightShare ?? 0);
}

/**
 * The weigh-in in force on a day: the latest one on or before it.
 *
 * `null` before the first weigh-in ever logged, rather than that first one projected
 * backwards — a session from before the scale existed has no honest body weight, and
 * inventing one posts tonnage the lifter never earned. Entries arrive oldest first, which
 * is the order both the store and the server hand them out in.
 */
export function bodyweightOn(entries: BodyweightEntry[], date: string): number | null {
	const held = entries.findLast((entry) => entry.date <= date);

	return held === undefined ? null : held.kg;
}

/** The resolver every statistic reads body weight through: every absence comes out as zero. */
export function carriedFrom(
	entries: BodyweightEntry[],
	exerciseOf: (exerciseId: string) => Exercise | undefined
): Carried {
	// One walk of the log per day rather than per set: weekly work asks this of every set in
	// twelve weeks, and the log grows by a row a morning.
	const byDay = new Map<string, number | null>();

	return (exerciseId, at) => {
		const share = bodyweightShareOf(exerciseOf(exerciseId));

		if (share === 0) {
			return 0;
		}

		const date = localDateOf(new Date(at));

		if (!byDay.has(date)) {
			byDay.set(date, bodyweightOn(entries, date));
		}

		return (byDay.get(date) ?? 0) * share;
	};
}
