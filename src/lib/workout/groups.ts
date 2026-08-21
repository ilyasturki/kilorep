import { interleave, legCursors } from '$lib/domain/workout';
import type { Exercise } from '$lib/domain/exercise';
import { gripLabel, settleGrip } from '$lib/domain/grip';
import type { SetCursor, Workout, WorkoutSet } from '$lib/domain/workout';
import type { SetStatus } from '$lib/ui/SetMark.svelte';

/**
 * What this set says that its exercise does not.
 *
 * Only the difference. The heading already carries the grip the exercise is on, so repeating it
 * on all five sets would be five sets of noise to mark the one that is unusual — and a set that
 * matches the setup has nothing to add.
 */
export function setNote(
	meta: Exercise | undefined,
	legGrip: string | undefined,
	set: WorkoutSet
): string | null {
	const parts: string[] = [];
	const grip = settleGrip(meta, set.grip);

	if (grip !== undefined && grip !== settleGrip(meta, legGrip)) {
		parts.push(gripLabel(meta, grip) ?? grip);
	}

	if (set.arms === 'one') {
		parts.push('One arm');
	}

	return parts.length === 0 ? null : parts.join(' · ');
}

export function statusOf(cursor: SetCursor): SetStatus {
	if (cursor.set.type === 'warmup') {
		return 'warmup';
	}

	return cursor.set.completed ? 'done' : 'pending';
}

export type Group = {
	id: string;
	meta: Exercise;
	grip?: string;
	cursors: SetCursor[];
};

type Legged<L> = { id: string; legs: L[] };

export type Entry = {
	id: string;
	legs: Group[];
	cursors: SetCursor[];
	superset: boolean;
	title: string;
};

export function entryTitle(legs: { meta: Exercise }[]): string {
	return legs
		.map((leg): Exercise | undefined => leg.meta)
		.filter((meta) => meta !== undefined)
		.map((meta) => meta.name)
		.join(' + ');
}

export function legOf<L extends { id: string }>(entries: Legged<L>[], id: string | null): L | null {
	if (id === null) {
		return null;
	}

	return entries.flatMap((entry) => entry.legs).find((leg) => leg.id === id) ?? null;
}

export function entryOf<E extends Legged<{ id: string }>>(
	entries: E[],
	id: string | null
): E | null {
	if (id === null) {
		return null;
	}

	return entries.find((entry) => entry.legs.some((leg) => leg.id === id)) ?? null;
}

export function shelfOf(
	entries: Legged<{ meta: Exercise }>[],
	exclude: string,
	title: string
): { title: string; exercises: Exercise[] } | null {
	const exercises = [
		...new Map(
			entries
				.filter((entry) => entry.id !== exclude)
				.flatMap((entry) => entry.legs)
				.filter((leg) => leg.meta !== undefined)
				.map((leg) => [leg.meta.id, leg.meta] as const)
		).values()
	];

	return exercises.length === 0 ? null : { title, exercises };
}

export function entriesWithMeta(workout: Workout, catalog: Record<string, Exercise>): Entry[] {
	return workout.entries.map((entry) => {
		const legs = entry.exercises.map((exercise) => ({
			id: exercise.id,
			meta: catalog[exercise.exerciseId],
			grip: exercise.grip,
			cursors: legCursors(entry, exercise)
		}));

		return {
			id: entry.id,
			legs,
			cursors: interleave(legs.map((leg) => leg.cursors)),
			superset: legs.length > 1,
			title: entryTitle(legs)
		};
	});
}
