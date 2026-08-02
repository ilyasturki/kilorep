/**
 * A planned exercise joined to its catalog meta, and the one line that
 * describes its shape.
 *
 * The workout side's `$lib/workout/groups.ts`, restated for the template tree —
 * same boundary, same reason: the catalog lookup is presentation and stops
 * here rather than dragging a name table into the domain. Named once because
 * the editor pane builds these and the sidebar reads them, and two independent
 * declarations of the same shape drift silently under structural typing.
 *
 * No framework import, so the readouts below are testable on their own.
 */

import type { Exercise } from '$lib/domain/exercise';
import type { Template, TemplateExercise } from '$lib/domain/template';

export type Planned = {
	/** The exercise node id — what an `{#each}` keys on and a removal names. */
	id: string;
	/**
	 * Carried through rather than resolved again at the screen: reorder acts on
	 * the entry, and a list that had to walk back into the tree to find out
	 * which one a row belongs to would be re-deriving what this walk knew.
	 */
	entryId: string;
	meta: Exercise;
	exercise: TemplateExercise;
};

export function plannedGroups(template: Template, catalog: Record<string, Exercise>): Planned[] {
	return template.entries.flatMap((entry) =>
		entry.exercises.map((exercise) => ({
			id: exercise.id,
			entryId: entry.id,
			meta: catalog[exercise.exerciseId],
			exercise
		}))
	);
}

/**
 * What an exercise prescribes, in the four states the editor has to draw.
 *
 * `fixed` is the overwhelming case and the one the whole card is shaped around
 * — three sets of eight, one number for the exercise. The other three exist
 * because the editor must never print a number the plan does not hold:
 *
 * - `open` — nothing prescribed yet, on any set.
 * - `range` — every set names a number and they disagree: a 12/10/8 pyramid,
 *   spelled as its ends.
 * - `mixed` — some sets name a number and some are open. A range here would
 *   quietly drop the open sets from a label claiming to describe all of them,
 *   so this state says only that it is mixed and sends the reader to the
 *   per-set steppers.
 *
 * `reps` is what a shared stepper steps from, and it is non-null in exactly
 * the `fixed` case — the only one where a single arm can move the whole
 * exercise without inventing a number for the sets it disagrees with.
 */
export type PlanShape = {
	sets: number;
	kind: 'open' | 'fixed' | 'range' | 'mixed';
	/** The target as one word: "Open", "8", "8–12", "Mixed". */
	target: string;
	reps: number | null;
};

export function planShape(exercise: TemplateExercise): PlanShape {
	const sets = exercise.sets.length;
	const targets = exercise.sets.map((set) => set.plannedReps);
	const numbers = targets.filter((reps): reps is number => reps !== null);

	if (numbers.length === 0) {
		return { sets, kind: 'open', target: 'Open', reps: null };
	}

	if (numbers.length < sets) {
		return { sets, kind: 'mixed', target: 'Mixed', reps: null };
	}

	const low = Math.min(...numbers);
	const high = Math.max(...numbers);

	if (low === high) {
		return { sets, kind: 'fixed', target: String(low), reps: low };
	}

	// En dash, not a hyphen: it is a range and Nunito carries the glyph — the
	// same one `StepperField` prints for a field with nothing in it.
	return { sets, kind: 'range', target: `${low}–${high}`, reps: null };
}

/** The stepper's own readout — the target, worded. */
export function repsLabel(shape: PlanShape): string {
	return shape.kind === 'fixed' || shape.kind === 'range' ? `${shape.target} reps` : shape.target;
}

export function setsLabel(count: number): string {
	return count === 1 ? '1 set' : `${count} sets`;
}

/**
 * The whole exercise in one glance, for a sidebar row that has no room for
 * steppers: `3 × 8`, `3 × 8–12`, `3 × Open`. `×` is a character Nunito carries,
 * per the icons README, and the same one the workout's hint labels use.
 */
export function planSummary(exercise: TemplateExercise): string {
	const shape = planShape(exercise);

	return `${shape.sets} × ${shape.target}`;
}
