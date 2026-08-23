import type { Exercise } from '$lib/domain/exercise';
import type { NextUp } from '$lib/domain/rotation';
import type { Template, TemplateExercise } from '$lib/domain/template';
import { entryTitle } from '$lib/workout/groups';

export type Planned = {
	id: string;
	meta: Exercise;
	exercise: TemplateExercise;
};

export type PlannedEntry = {
	id: string;
	legs: Planned[];
	superset: boolean;
	title: string;
};

export function plannedEntries(
	template: Template,
	catalog: Record<string, Exercise>
): PlannedEntry[] {
	return template.entries.map((entry) => {
		const legs = entry.exercises.map((exercise) => ({
			id: exercise.id,
			meta: catalog[exercise.exerciseId],
			exercise
		}));

		return {
			id: entry.id,
			legs,
			superset: legs.length > 1,
			title: entryTitle(legs)
		};
	});
}

// Two full catalog names is what a phone row fits before truncating.
const NAMED = 2;

export function planLine(template: Template, catalog: Record<string, Exercise>): string {
	const titles = template.entries
		.map((entry) =>
			entryTitle(entry.exercises.map((exercise) => ({ meta: catalog[exercise.exerciseId] })))
		)
		.filter((title) => title !== '');

	if (titles.length === 0) {
		return 'No exercises yet';
	}

	const named = titles.slice(0, NAMED).join(' · ');
	const rest = titles.length - NAMED;

	return rest > 0 ? `${named} +${rest} more` : named;
}

export function templateTitle(template: Template): string {
	return template.name.trim() === '' ? 'Untitled' : template.name;
}

/**
 * Why this plan and not another, in the few words a caps header holds.
 *
 * It rides the header rather than the card because the card is already three lines of what
 * the plan *is*, and a fourth line of why it was picked competes with them for a width a
 * phone does not have. Up there it has a row to itself and nothing to truncate against.
 *
 * A rotation of one has to say something other than "after itself", which is true and reads
 * as a bug; a rotation nobody has trained yet has no step to report at all.
 */
export function rotationLine(next: NextUp): string {
	if (next.after === null) {
		return 'first in your rotation';
	}

	return next.after.id === next.plan.id ? 'again' : `after ${templateTitle(next.after)}`;
}

export type PlanShape = {
	sets: number;
	kind: 'open' | 'fixed' | 'range' | 'mixed';
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

	return { sets, kind: 'range', target: `${low}–${high}`, reps: null };
}

/**
 * What the shared rep field cannot say for itself.
 *
 * The field holds one number or none, so every shape but a settled target draws as empty —
 * this is the line beneath it, naming which emptiness that is.
 */
export function targetNote(shape: PlanShape): string | null {
	if (shape.kind === 'fixed') {
		return null;
	}

	if (shape.kind === 'range') {
		return `${shape.target} per set`;
	}

	return shape.kind === 'open' ? 'Open target' : 'Targets differ per set';
}

export function setsLabel(count: number): string {
	return count === 1 ? '1 set' : `${count} sets`;
}

export function exercisesLabel(count: number): string {
	return count === 1 ? '1 exercise' : `${count} exercises`;
}

/** What the plan asks of you, in the shape History states what a session took. */
export function planMeta(template: Template): string {
	const exercises = template.entries.flatMap((entry) => entry.exercises);
	const sets = exercises.reduce((count, exercise) => count + exercise.sets.length, 0);

	return `${exercisesLabel(exercises.length)} · ${setsLabel(sets)}`;
}

export function planSummary(exercise: TemplateExercise): string {
	const shape = planShape(exercise);

	return `${shape.sets} × ${shape.target}`;
}

export function entrySummary(exercises: TemplateExercise[]): string {
	return exercises.map((exercise) => planSummary(exercise)).join(' + ');
}
