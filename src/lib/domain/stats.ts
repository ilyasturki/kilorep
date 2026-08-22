import type { CarriedOn } from '$lib/domain/load';
import type { PerformedSet } from '$lib/domain/workout';

export type PastSession = {
	date: number;
	workoutId: string;
	position: number;
	sets: PerformedSet[];
};

/**
 * The heaviest set of one session.
 *
 * Body weight is not read here and does not need to be: every set in a session carried the
 * same body, so it shifts the whole comparison by one constant and can change nothing about
 * which set of the day was the heaviest.
 */
export function bestSet(sets: PerformedSet[]): PerformedSet | null {
	let best: PerformedSet | null = null;

	for (const set of sets) {
		if (
			best === null ||
			set.weight > best.weight ||
			(set.weight === best.weight && set.reps > best.reps)
		) {
			best = set;
		}
	}

	return best;
}

export function estimated1Rm(set: PerformedSet, carried: number): number {
	const load = set.weight + carried;

	return set.reps <= 1 ? load : load * (1 + set.reps / 30);
}

/**
 * The heaviest thing ever lifted on an exercise, body included.
 *
 * `load` is what was moved and `set.weight` what was added to it — the same number twice on
 * a barbell, and eighty-eight against ten on a pull-up.
 */
export type Best = { set: PerformedSet; date: number; load: number };

export function rawPr(sessions: PastSession[], carried: CarriedOn): Best | null {
	let best: Best | null = null;

	for (const session of sessions) {
		const body = carried(session.date);

		for (const set of session.sets) {
			const load = set.weight + body;

			// Strict, and the sessions arrive oldest first: matching a best later never moves it.
			if (best === null || load > best.load || (load === best.load && set.reps > best.set.reps)) {
				best = { set, date: session.date, load };
			}
		}
	}

	return best;
}

/**
 * The session that estimates highest, and the set inside it that does.
 *
 * A different question from `rawPr`, and sometimes a different day: ten reps at ninety
 * estimate above three at a hundred, so the heaviest thing ever lifted and the best the
 * lifter has ever looked are two facts, and a history that marked only the first would
 * leave the harder session unremarked. Strict, like the best above it, and the sessions
 * arrive oldest first: matching an estimate later never moves it.
 */
export type Estimate = { set: PerformedSet; date: number; est: number };

export function bestEstimate(sessions: PastSession[], carried: CarriedOn): Estimate | null {
	let best: Estimate | null = null;

	for (const session of sessions) {
		const body = carried(session.date);

		for (const set of session.sets) {
			const est = estimated1Rm(set, body);

			if (best === null || est > best.est) {
				best = { set, date: session.date, est };
			}
		}
	}

	return best;
}

/**
 * Epley read backwards: what one set of `reps` has to move to estimate `est`.
 *
 * The load, body included — what has to go on the belt is this minus what the body already
 * carries, and the caller holding the weigh-in is the one that can subtract it.
 */
export function loadForReps(est: number, reps: number): number {
	return reps <= 1 ? est : est / (1 + reps / 30);
}
