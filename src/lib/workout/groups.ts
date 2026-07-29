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
import type { Exercise, SetCursor, Workout } from '$lib/domain/workout';

export type Group = { meta: Exercise; cursors: SetCursor[] };

export function groupsWithMeta(workout: Workout, catalog: Record<string, Exercise>): Group[] {
	return groupsOf(workout).map((group) => ({
		meta: catalog[group.exerciseId],
		cursors: group.cursors
	}));
}
