import { FOLDED } from '$lib/catalog';
import type { Template } from '$lib/domain/template';
import type { Workout } from '$lib/domain/workout';

function foldOf(exerciseId: string): { id: string; grip: string } | undefined {
	return FOLDED[exerciseId];
}

/**
 * Retired slugs read as the grip they became, on the way out of the store.
 *
 * Read, never rewritten. Sync is last-write-wins per record, so rewriting a stored workout on
 * one device would hand a device still on an older build a session naming an exercise it has
 * never heard of — and it would win, because it wrote last. Folding on the way out leaves what
 * is on disk exactly as it was written, which is what keeps a build that predates the fold
 * correct.
 *
 * In place, because IndexedDB hands back a fresh structured clone on every read: the objects
 * arriving here are this read's own and nothing else holds them. A cached read would break
 * that, and would have to clone before folding.
 */
export function foldWorkout<W extends Workout>(workout: W): W {
	for (const entry of workout.entries) {
		for (const exercise of entry.exercises) {
			const fold = foldOf(exercise.exerciseId);

			if (fold === undefined) {
				continue;
			}

			exercise.exerciseId = fold.id;
			exercise.grip ??= fold.grip;

			for (const set of exercise.sets) {
				set.grip ??= fold.grip;
			}
		}
	}

	return workout;
}

export function foldTemplate<T extends Template>(template: T): T {
	for (const entry of template.entries) {
		for (const exercise of entry.exercises) {
			const fold = foldOf(exercise.exerciseId);

			if (fold === undefined) {
				continue;
			}

			exercise.exerciseId = fold.id;
			exercise.grip ??= fold.grip;
		}
	}

	return template;
}

/** Where a retired slug's own screen now lives, or null when the slug is still its own. */
export function foldedTo(exerciseId: string): string | null {
	const fold = foldOf(exerciseId);

	return fold === undefined ? null : fold.id;
}
