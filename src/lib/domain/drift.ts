/**
 * Drift: how a finished workout's structure differs from the template it
 * started from — the question `startFrom` left `templateId` behind to answer.
 *
 * Plain TypeScript with zero framework imports, per STACK.md's standing rule.
 *
 * The baseline is the template as it exists *now*. The workout's nodes were
 * re-minted at start, so there is no id thread back to the plan's nodes and
 * nothing older to diff against; a template edited since the session shows
 * drift against today's plan, which is the honest reading of "does what I did
 * still match what I plan". A deleted template has no baseline at all — the
 * caller simply has no `Template` to hand in, and no drift is computed.
 *
 * Structural only, by decision: exercises and sets present or absent, and rep
 * targets moved. Reps performed against `plannedReps` is performance, not
 * deviation from plan — the workout already carries both numbers and the
 * screen renders them side by side without calling it drift.
 */

import type { Template, TemplateExercise } from './template.ts';
import type { Workout, WorkoutExercise, WorkoutSet } from './workout.ts';

/** How one performed exercise's sets sit against its matched plan slot. */
export type SetDrift = {
	/** Working sets beyond the plan's count. */
	added: number;
	/** Planned sets with no working counterpart. */
	removed: number;
	/** Positions where both trees hold a set but the rep target differs. */
	retargeted: number;
};

export type Drift = {
	/**
	 * Workout exercise node id → set-level drift against its plan slot. Every
	 * matched exercise appears, drifted or not, so absence means unplanned
	 * rather than clean.
	 */
	matched: Record<string, SetDrift>;
	/** Workout exercise node ids the plan has no slot for. */
	unplanned: string[];
	/** Catalog exercise ids planned but never performed, in plan order. */
	missing: string[];
};

/**
 * Sets that occupy a plan slot: everything but warmups. Structure, not
 * performance — an unchecked working set is a slot the lifter kept and left
 * empty, so it still stands against the plan's count; a warmup added on the
 * floor was never planned and never will be, because a template set has no
 * type to plan one with.
 */
function workingSets(exercise: WorkoutExercise): WorkoutSet[] {
	return exercise.sets.filter((set) => set.type !== 'warmup');
}

function setDriftOf(performed: WorkoutExercise, planned: TemplateExercise): SetDrift {
	const working = workingSets(performed);
	const shared = Math.min(working.length, planned.sets.length);

	let retargeted = 0;

	for (let i = 0; i < shared; i += 1) {
		if (working[i].plannedReps !== planned.sets[i].plannedReps) {
			retargeted += 1;
		}
	}

	return {
		added: Math.max(0, working.length - planned.sets.length),
		removed: Math.max(0, planned.sets.length - working.length),
		retargeted
	};
}

/**
 * The diff. Matching is by catalog exercise and order of occurrence — the nth
 * performance of an exercise against the nth plan slot for it — because
 * that is all the re-minted ids leave to match on, and it is what a lifter
 * means: doing bench twice against a plan that lists it twice is no drift,
 * however the rows interleave.
 */
export function driftFrom(workout: Workout, template: Template): Drift {
	const slots = template.entries.flatMap((entry) => entry.exercises);
	const taken = new Set<string>();

	const matched: Record<string, SetDrift> = {};
	const unplanned: string[] = [];

	for (const entry of workout.entries) {
		for (const performed of entry.exercises) {
			const slot = slots.find(
				(candidate) => !taken.has(candidate.id) && candidate.exerciseId === performed.exerciseId
			);

			if (slot === undefined) {
				unplanned.push(performed.id);
			} else {
				taken.add(slot.id);
				matched[performed.id] = setDriftOf(performed, slot);
			}
		}
	}

	const missing = slots.filter((slot) => !taken.has(slot.id)).map((slot) => slot.exerciseId);

	return { matched, unplanned, missing };
}

export function hasSetDrift(drift: SetDrift): boolean {
	return drift.added > 0 || drift.removed > 0 || drift.retargeted > 0;
}

/** Whether anything at all deviated — what a one-line summary keys on. */
export function hasDrift(drift: Drift): boolean {
	return (
		drift.unplanned.length > 0 ||
		drift.missing.length > 0 ||
		Object.values(drift.matched).some((setDrift) => hasSetDrift(setDrift))
	);
}
