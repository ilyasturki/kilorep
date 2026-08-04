import { interleave, legCursors } from '$lib/domain/workout';
import type { Exercise } from '$lib/domain/exercise';
import type { SetCursor, Workout } from '$lib/domain/workout';
import type { SetStatus } from '$lib/ui/SetMark.svelte';

export function statusOf(cursor: SetCursor): SetStatus {
	if (cursor.set.type === 'warmup') {
		return 'warmup';
	}

	return cursor.set.completed ? 'done' : 'pending';
}

export type Group = {
	id: string;
	meta: Exercise;
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
