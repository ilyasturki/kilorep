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
 * What the rotation offers, and the session it stepped off to get there.
 *
 * `after` is the whole reason this is a pair rather than a plan: a screen holding both can
 * state the arithmetic it just did — *after Push A* — instead of presenting the result as a
 * fact from nowhere. It is absent when no plan has been trained at all, which is a different
 * sentence and not a missing one.
 */
export type NextUp = {
	plan: Template;
	after: Template | null;
};

/**
 * The plan after the one last trained, wrapping at the end — Push, Pull, Legs, Push.
 *
 * The anchor is the last session that ran a plan, not the last session: an empty workout
 * built on the gym floor is a detour, and a rotation that answered it with "start over"
 * would be reading its own absence as a position.
 */
export function nextUp(plans: Template[], lastDone: Record<string, number>): NextUp | null {
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

	// An untrained rotation leaves the anchor at -1, which steps to its own head — and names
	// nothing behind it, because there is no session back there to have stepped off.
	return {
		plan: plans[(anchor + 1) % plans.length],
		after: anchor === -1 ? null : plans[anchor]
	};
}
