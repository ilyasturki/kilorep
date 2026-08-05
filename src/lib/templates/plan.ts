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

/**
 * How many entries a row names before it starts counting instead.
 *
 * Two, because that is what a phone row actually fits: the names are the
 * catalog's own — `Incline Bench Press`, not `Incline` — and a third would be
 * an ellipsis in every case rather than a name in some.
 */
const NAMED = 2;

/**
 * What a template says about itself in a list: the movements, not the count.
 *
 * The Templates tab and the idle Workout screen both print this, which is why
 * it lives here rather than in either of them — the two screens show the same
 * plan and are required to word it identically, an invariant they used to keep
 * by copying a function and a comment saying so.
 *
 * Entries and not exercises, so a planned superset arrives as one item under
 * the name the editor and the workout pane already give it — `Incline Bench
 * Press + Cable Fly` — and the remainder counts entries too. That moves the
 * number off the old "4 exercises", deliberately: the row now describes the
 * shape of a session rather than its size, and a count that disagreed with the
 * names beside it would be the worse of the two readings.
 *
 * The tail is `workoutTitle`'s, one module over, for the reason a shared
 * vocabulary usually is: `+2 more` survives truncation, where a name that ran
 * off the end takes the whole count with it. The line still truncates behind
 * this — two long names overflow a narrow row on their own — so the tail is
 * what guarantees the row says how much it is holding back.
 */
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

/**
 * What a plan is called in a list, nameless ones included.
 *
 * A persisted template can be nameless — named-nothing but planned-something
 * escapes the blank rule — and four screens print that plan: the Templates
 * tab, the idle Train screen, the History row that names the session it came
 * from, and the sheet that adds an exercise to it. This was the same ternary
 * written out in each, which is one edit away from a list where a nameless
 * plan reads `Untitled` on one screen and as an empty row on the next.
 */
export function templateTitle(template: Template): string {
	return template.name.trim() === '' ? 'Untitled' : template.name;
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
