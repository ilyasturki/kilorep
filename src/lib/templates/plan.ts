import type { Exercise } from '$lib/domain/exercise';
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

	// En dash, not a hyphen: it is a range and Nunito carries the glyph — the
	// same one `StepperField` prints for a field with nothing in it.
	return { sets, kind: 'range', target: `${low}–${high}`, reps: null };
}

export function repsLabel(shape: PlanShape): string {
	return shape.kind === 'fixed' || shape.kind === 'range' ? `${shape.target} reps` : shape.target;
}

export function setsLabel(count: number): string {
	return count === 1 ? '1 set' : `${count} sets`;
}

export function planSummary(exercise: TemplateExercise): string {
	const shape = planShape(exercise);

	return `${shape.sets} × ${shape.target}`;
}

export function entrySummary(exercises: TemplateExercise[]): string {
	return exercises.map((exercise) => planSummary(exercise)).join(' + ');
}
