import {
	addExerciseTo as addToTree,
	exerciseIn,
	supersetWith as supersetWithTree
} from './tree.ts';
import type { ExerciseIds, NewExerciseIds } from './tree.ts';
import type { Workout, WorkoutEntry } from './workout.ts';

export {
	joinEntry,
	moveEntry,
	moveExercise,
	removeExercise,
	removeSet,
	splitEntry
} from './tree.ts';
export type { ExerciseIds, NewExerciseIds } from './tree.ts';

export type TemplateSet = {
	id: string;
	plannedReps: number | null;
};

export type TemplateExercise = {
	id: string;
	exerciseId: string;
	sets: TemplateSet[];
};

export type TemplateEntry = {
	id: string;
	exercises: TemplateExercise[];
};

export type Template = {
	id: string;
	name: string;
	createdAt: number;
	entries: TemplateEntry[];
};

/**
 * What "New template" opens on: nothing named, nothing planned.
 *
 * The id and the timestamp are the caller's — this module has no clock and no
 * randomness, the same reason `freshWorkout` is handed its `startedAt` — and
 * the id doubles as the route the editor lives at, so it has to exist before
 * the template does.
 */
export function blankTemplate(id: string, createdAt: number): Template {
	return { id, name: '', createdAt, entries: [] };
}

export function isBlank(template: Template): boolean {
	return template.name.trim() === '' && template.entries.length === 0;
}

export const PLANNED_SET_COUNT = 3;

export const PLANNED_REPS = 8;

const blankExercise =
	(catalogId: string) =>
	(ids: ExerciseIds): TemplateExercise => ({
		id: ids.exercise,
		exerciseId: catalogId,
		sets: ids.sets.map((id) => ({ id, plannedReps: null }))
	});

export function addExercise(
	template: Template,
	exerciseId: string,
	ids: NewExerciseIds
): TemplateEntry | null {
	if (ids.sets.length === 0) {
		return null;
	}

	const entry: TemplateEntry = { id: ids.entry, exercises: [blankExercise(exerciseId)(ids)] };

	template.entries.push(entry);

	return entry;
}

export function addExerciseTo(
	template: Template,
	entryId: string,
	catalogId: string,
	ids: ExerciseIds
): TemplateExercise | null {
	return addToTree(template, entryId, ids, blankExercise(catalogId));
}

export function supersetWith(
	template: Template,
	entryId: string,
	catalogId: string,
	ids: ExerciseIds
): boolean {
	return supersetWithTree(template, entryId, catalogId, ids, blankExercise(catalogId));
}

export function replaceExercise(
	template: Template,
	exerciseId: string,
	catalogId: string
): boolean {
	const exercise = exerciseIn(template, exerciseId);

	if (exercise === null || exercise.exerciseId === catalogId) {
		return false;
	}

	exercise.exerciseId = catalogId;

	return true;
}

export function addSet(template: Template, exerciseId: string, id: string): TemplateSet | null {
	const exercise = exerciseIn(template, exerciseId);

	if (exercise === null) {
		return null;
	}

	const last = exercise.sets.at(-1);
	const set: TemplateSet = { id, plannedReps: last === undefined ? null : last.plannedReps };

	exercise.sets.push(set);

	return set;
}

export function setPlannedReps(template: Template, setId: string, reps: number | null): boolean {
	if (reps !== null && reps < 1) {
		return false;
	}

	for (const entry of template.entries) {
		for (const exercise of entry.exercises) {
			for (const set of exercise.sets) {
				if (set.id === setId) {
					set.plannedReps = reps;

					return true;
				}
			}
		}
	}

	return false;
}

export function setExerciseReps(
	template: Template,
	exerciseId: string,
	reps: number | null
): boolean {
	if (reps !== null && reps < 1) {
		return false;
	}

	const exercise = exerciseIn(template, exerciseId);

	if (exercise === null) {
		return false;
	}

	for (const set of exercise.sets) {
		set.plannedReps = reps;
	}

	return true;
}

export function startFrom(template: Template, startedAt: number, mint: () => string): Workout {
	const entries: WorkoutEntry[] = template.entries.map((entry) => ({
		id: mint(),
		exercises: entry.exercises.map((exercise) => ({
			id: mint(),
			exerciseId: exercise.exerciseId,
			sets: exercise.sets.map((set) => ({
				id: mint(),
				type: 'normal' as const,
				plannedReps: set.plannedReps,
				rpe: null,
				weight: null,
				reps: null,
				completed: false
			}))
		}))
	}));

	return { id: mint(), templateId: template.id, startedAt, entries };
}
