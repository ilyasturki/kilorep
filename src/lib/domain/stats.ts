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
