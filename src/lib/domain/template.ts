import { settleRestSeconds } from './rest.ts';
import {
	addExerciseTo as addToTree,
	exerciseIn,
	supersetWith as supersetWithTree
} from './tree.ts';
import type { ExerciseIds, NewExerciseIds } from './tree.ts';
import type { Workout, WorkoutEntry, WorkoutExercise } from './workout.ts';

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
	// Tri-state: absent key = inherit exercise/default, number = override, null = never rest here.
	restSeconds?: number | null;
};

export type TemplateEntry = {
	id: string;
	exercises: TemplateExercise[];
};

export const MARK_ICONS = [
	'push',
	'pull',
	'legs',
	'core',
	'grip',
	'barbell',
	'machine',
	'run',
	'bike',
	'heavy',
	'power',
	'burn',
	'cardio',
	'steps',
	'star'
] as const;

export type MarkIcon = (typeof MARK_ICONS)[number];

export const MARK_COLOURS = ['amber', 'teal', 'blue', 'violet', 'fuchsia', 'slate'] as const;

export type MarkColour = (typeof MARK_COLOURS)[number];

export type TemplateMark = {
	icon: MarkIcon | null;
	colour: MarkColour | null;
};

export type Template = {
	id: string;
	name: string;
	createdAt: number;
	entries: TemplateEntry[];
	mark?: TemplateMark | null;
	order?: number;
	archivedAt?: number | null;
};

export function templateRank(template: Template): number {
	return template.order ?? template.createdAt;
}

export function byRank(a: Template, b: Template): number {
	return templateRank(a) - templateRank(b);
}

export function isArchived(template: Template): boolean {
	return template.archivedAt !== undefined && template.archivedAt !== null;
}

/** The plans a tap can start, in the order they were given. */
export function startable(templates: Template[]): Template[] {
	return templates.filter((template) => !isArchived(template));
}

// 1000, not 1: ranks are epoch-ms scale and must survive repeated midpoint halving in `reorder`.
const RANK_GAP = 1000;

export function reorder(templates: Template[], id: string, index: number): number | null {
	const ordered = templates.toSorted(byRank);
	const from = ordered.findIndex((template) => template.id === id);

	if (from === -1 || index < 0 || index >= ordered.length || index === from) {
		return null;
	}

	const rest = ordered.filter((template) => template.id !== id);
	const before = rest[index - 1];
	const after = rest[index];

	if (before === undefined) {
		return templateRank(after) - RANK_GAP;
	}

	if (after === undefined) {
		return templateRank(before) + RANK_GAP;
	}

	return (templateRank(before) + templateRank(after)) / 2;
}

// Synced records can carry mark keys from newer builds; unknown halves render as absent
// but the stored payload is never rewritten.
export function drawableMark(template: Template): TemplateMark | null {
	const mark = template.mark;

	if (mark === undefined || mark === null) {
		return null;
	}

	const icons: readonly string[] = MARK_ICONS;
	const colours: readonly string[] = MARK_COLOURS;

	const icon = mark.icon !== null && icons.includes(mark.icon) ? mark.icon : null;
	const colour = mark.colour !== null && colours.includes(mark.colour) ? mark.colour : null;

	return icon === null && colour === null ? null : { icon, colour };
}

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

// `undefined` means "inherit again" and deletes the key — `restSecondsOf` reads an absence,
// never a present-but-undefined key.
export function setExerciseRest(
	template: Template,
	exerciseId: string,
	seconds: number | null | undefined
): boolean {
	const exercise = exerciseIn(template, exerciseId);

	if (exercise === null) {
		return false;
	}

	if (seconds === undefined) {
		delete exercise.restSeconds;
	} else {
		exercise.restSeconds = seconds === null ? null : settleRestSeconds(seconds);
	}

	return true;
}

export function startFrom(template: Template, startedAt: number, mint: () => string): Workout {
	const entries: WorkoutEntry[] = template.entries.map((entry) => ({
		id: mint(),
		exercises: entry.exercises.map((exercise) => {
			const copy: WorkoutExercise = {
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
			};

			if (exercise.restSeconds !== undefined) {
				copy.restSeconds = exercise.restSeconds;
			}

			return copy;
		})
	}));

	return { id: mint(), templateId: template.id, startedAt, entries };
}
