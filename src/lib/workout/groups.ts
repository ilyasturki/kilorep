/**
 * A domain group joined to its catalog meta, and the entry that holds it.
 *
 * The walks themselves are domain rules and live in `$lib/domain/workout` with
 * the tests that keep them honest. What is left here is the join: a group knows
 * the `exerciseId` it was performed under, and a screen needs the name and the
 * equipment to render it. That lookup is presentation, so it stops at this
 * boundary rather than dragging the catalog into the domain.
 *
 * Named once because the screen builds these and the overview reads them, and
 * two independent declarations of the same shape drift silently under
 * structural typing — the same reason `SetMark` exports `SetStatus` rather than
 * letting `SetRow` keep a second union.
 */

import { interleave, legCursors } from '$lib/domain/workout';
import type { Exercise } from '$lib/domain/exercise';
import type { SetCursor, Workout } from '$lib/domain/workout';

export type Group = {
	/**
	 * The domain group's node id, not `meta.id` — the screens key their
	 * `{#each}` blocks on this, and the same exercise performed twice in one
	 * session is two groups. See `SetGroup`.
	 */
	id: string;
	meta: Exercise;
	cursors: SetCursor[];
};

/**
 * The legs of an entry, joined to their names — what every screen actually
 * draws a block from.
 *
 * Shared by both trees through the structural type, which is all either of them
 * needs to answer the three questions the routes ask: which leg was tapped,
 * which entry holds it, and what to pin above the catalog. A superset is the
 * one shape where those stop being the same question.
 */
type Legged<L> = { id: string; legs: L[] };

/**
 * One entry, its legs and everything under it — the unit the pane stacks, the
 * lists draw a row for, and the drag moves.
 *
 * The level above `Group`, and the one the screens actually iterate now that an
 * entry can hold more than one exercise. A superset drawn as two independent
 * blocks was the state of things while nothing could make one: there was
 * nothing to bracket, nothing to title jointly, and no round order to respect.
 */
export type Entry = {
	id: string;
	legs: Group[];
	/**
	 * Every set under the entry, in the order it is performed — round by round
	 * across the legs, per `interleave`. Leg order would be the wrong answer for
	 * the one question this is asked: where a tap on the row should land.
	 */
	cursors: SetCursor[];
	/** More than one leg, which is the whole of what makes it a superset. */
	superset: boolean;
	/** `Cable Fly + Lateral Raise`, or just the one name. */
	title: string;
};

/**
 * How an entry names itself: every leg's name, joined by the plus a lifter
 * would write. One leg is just that leg's name and pays nothing for the level
 * above it.
 *
 * A leg whose catalog id missed is skipped rather than named raw — a slug in a
 * title is a rendering bug, not information. `workoutTitle` states the same
 * widening for the same reason, and the annotation is what says it: a stored id
 * is any string, so the map's value type is wider than it looks.
 */
export function entryTitle(legs: { meta: Exercise }[]): string {
	const names: string[] = [];

	for (const leg of legs) {
		const meta: Exercise | undefined = leg.meta;

		if (meta !== undefined) {
			names.push(meta.name);
		}
	}

	return names.join(' + ');
}

/** The leg a menu is acting on, by node id, across every entry. */
export function legOf<L extends { id: string }>(entries: Legged<L>[], id: string | null): L | null {
	if (id === null) {
		return null;
	}

	return entries.flatMap((entry) => entry.legs).find((leg) => leg.id === id) ?? null;
}

/** The entry that leg stands in — what pairing and breaking act on. */
export function entryOf<E extends Legged<{ id: string }>>(
	entries: E[],
	id: string | null
): E | null {
	if (id === null) {
		return null;
	}

	return entries.find((entry) => entry.legs.some((leg) => leg.id === id)) ?? null;
}

/**
 * What the superset sheet pins above the catalog: everything else on the list,
 * which is what pairing usually means — both movements are already there and
 * only the pairing is missing.
 *
 * The acting entry's own legs are left out. They have nothing to join, and
 * offering them would be a row that does nothing when tapped.
 *
 * Deduplicated by catalog id: the same exercise twice is two nodes but one
 * name, and two identical rows would be a choice between indistinguishable
 * answers. Which node a pick then moves is `supersetWith`'s rule, and it is the
 * first — the nearest thing to "the one you meant" that an id can express.
 *
 * Null rather than an empty shelf, so a caller can hand it straight to the
 * sheet and get the next band down instead of a heading over nothing.
 */
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

/**
 * The session as entries, each holding its legs.
 *
 * Walked once. The legs are built straight off the tree and the round order is
 * `interleave` over the cursors those legs already hold — the alternative,
 * flattening the session and filtering it back apart per entry, built every
 * cursor twice and re-scanned the flat list once per entry to recover grouping
 * the tree had already stated.
 */
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
