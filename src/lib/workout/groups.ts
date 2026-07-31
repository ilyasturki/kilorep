/**
 * A domain group joined to its catalog meta.
 *
 * The walk itself is a domain rule and lives in `$lib/domain/workout` with the
 * tests that keep it honest. What is left here is the join: a group knows the
 * `exerciseId` it was performed under, and a screen needs the name and the
 * equipment to render it. That lookup is presentation, so it stops at this
 * boundary rather than dragging the catalog into the domain.
 *
 * Named once because the screen builds these and the overview reads them, and
 * two independent declarations of the same shape drift silently under
 * structural typing — the same reason `SetMark` exports `SetStatus` rather than
 * letting `SetRow` keep a second union.
 */

import { groupsOf } from '$lib/domain/workout';
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
	entryId: string;
	cursors: SetCursor[];
};

export function groupsWithMeta(workout: Workout, catalog: Record<string, Exercise>): Group[] {
	return groupsOf(workout).map((group) => ({
		id: group.id,
		meta: catalog[group.exerciseId],
		// Carried through rather than resolved again at the screen: reorder acts
		// on the entry, and a list that had to go back to the tree to find out
		// which one a row belongs to would be re-deriving what the walk knew.
		entryId: group.entryId,
		cursors: group.cursors
	}));
}
