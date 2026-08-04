import type { PerformedSet } from '$lib/domain/workout';

export type PastSession = {
	date: number;
	workoutId: string;
	position: number;
	sets: PerformedSet[];
};

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

export function estimated1Rm(set: PerformedSet): number {
	return set.reps <= 1 ? set.weight : set.weight * (1 + set.reps / 30);
}

export function rawPr(sessions: PastSession[]): { set: PerformedSet; date: number } | null {
	const best = bestSet(sessions.flatMap((session) => session.sets));

	if (best === null) {
		return null;
	}

	const holder = sessions.find((session) => session.sets.includes(best));

	return holder === undefined ? null : { set: best, date: holder.date };
}
