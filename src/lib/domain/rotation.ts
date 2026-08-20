import type { Template } from './template.ts';
import type { Workout } from './workout.ts';

/** When each plan was last trained. Untrained plans are absent rather than zero. */
export function lastDoneByTemplate(workouts: Workout[]): Record<string, number> {
	const seen: Record<string, number> = {};

	for (const workout of workouts) {
		const id = workout.templateId;

		if (id === null || id === undefined) {
			continue;
		}

		const known = seen[id];

		if (known === undefined || workout.startedAt > known) {
			seen[id] = workout.startedAt;
		}
	}

	return seen;
}

/**
 * The plan after the one last trained, wrapping at the end — Push, Pull, Legs, Push.
 *
 * The anchor is the last session that ran a plan, not the last session: an empty workout
 * built on the gym floor is a detour, and a rotation that answered it with "start over"
 * would be reading its own absence as a position.
 */
export function nextUp(plans: Template[], lastDone: Record<string, number>): Template | null {
	if (plans.length === 0) {
		return null;
	}

	let anchor = -1;
	let latest = Number.NEGATIVE_INFINITY;

	for (const [index, plan] of plans.entries()) {
		const at = lastDone[plan.id];

		if (at !== undefined && at > latest) {
			anchor = index;
			latest = at;
		}
	}

	// An untrained rotation leaves the anchor at -1, which steps to its own head.
	return plans[(anchor + 1) % plans.length];
}
