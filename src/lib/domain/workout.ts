import { exertionSuffix, isExertion, settleExertion } from './exertion.ts';
import type { ExertionScale } from './exertion.ts';
import {
	addExerciseTo as addToTree,
	exerciseIn,
	supersetWith as supersetWithTree
} from './tree.ts';
import type { ExerciseIds, NewExerciseIds } from './tree.ts';

export {
	joinEntry,
	moveEntry,
	moveExercise,
	removeExercise,
	removeSet,
	splitEntry
} from './tree.ts';
export type { ExerciseIds, NewExerciseIds } from './tree.ts';

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export type PerformedSet = { weight: number; reps: number; rpe: number | null };

export type History = Record<string, PerformedSet[] | undefined>;

export type WorkoutSet = {
	id: string;
	type: SetType;
	plannedReps: number | null;
	weight: number | null;
	reps: number | null;
	rpe: number | null;
	completed: boolean;
};

export type WorkoutExercise = {
	id: string;
	exerciseId: string;
	sets: WorkoutSet[];
	// Copied from the plan at start; tri-state as in TemplateExercise.restSeconds.
	restSeconds?: number | null;
};

export type WorkoutEntry = {
	id: string;
	exercises: WorkoutExercise[];
};

export type Workout = {
	id: string;
	templateId: string | null;
	startedAt: number;
	entries: WorkoutEntry[];
};

export type SetCursor = {
	set: WorkoutSet;
	exercise: WorkoutExercise;
	entry: WorkoutEntry;
	workingIndex: number;
};

export function legCursors(entry: WorkoutEntry, exercise: WorkoutExercise): SetCursor[] {
	let working = 0;

	return exercise.sets.map((set) => ({
		set,
		exercise,
		entry,
		workingIndex: set.type === 'warmup' ? -1 : working++
	}));
}

export function interleave(legs: SetCursor[][]): SetCursor[] {
	if (legs.length < 2) {
		return legs.length === 0 ? [] : legs[0];
	}

	const warmups = legs.flatMap((leg) => leg.filter((cursor) => cursor.workingIndex === -1));
	const working = legs.map((leg) => leg.filter((cursor) => cursor.workingIndex !== -1));
	const rounds = Math.max(...working.map((leg) => leg.length));

	const out = [...warmups];

	for (let round = 0; round < rounds; round += 1) {
		out.push(...working.map((leg) => leg[round]).filter((cursor) => cursor !== undefined));
	}

	return out;
}

export function entryCursors(entry: WorkoutEntry): SetCursor[] {
	return interleave(entry.exercises.map((exercise) => legCursors(entry, exercise)));
}

export function cursors(workout: Workout): SetCursor[] {
	return workout.entries.flatMap((entry) => entryCursors(entry));
}

export function cursorFor(workout: Workout, setId: string): SetCursor | null {
	return cursors(workout).find((c) => c.set.id === setId) ?? null;
}

export function firstUncompleted(workout: Workout): SetCursor | null {
	return cursors(workout).find((c) => !c.set.completed) ?? null;
}

// Forward only. Coming back for the gaps left behind dragged the lifter to an exercise two
// screens up on the set that should have ended the session; a skipped set is reached by tapping it.
export function advanceFrom(workout: Workout, setId: string): SetCursor | null {
	const all = cursors(workout);
	const at = all.findIndex((c) => c.set.id === setId);

	return all.slice(at + 1).find((c) => !c.set.completed) ?? null;
}

export function hintFor(
	history: History,
	exerciseId: string,
	workingIndex: number
): PerformedSet | null {
	if (workingIndex < 0) {
		return null;
	}

	return (history[exerciseId] ?? [])[workingIndex] ?? null;
}

export function hintLabel(
	history: History,
	cursor: SetCursor,
	scale: ExertionScale | null = null
): string | null {
	const hint = hintFor(history, cursor.exercise.exerciseId, cursor.workingIndex);

	if (hint === null) {
		return null;
	}

	const felt = scale === null ? '' : exertionSuffix(hint.rpe, scale);

	return `${hint.weight} × ${hint.reps}${felt}`;
}

export type Prefill = { weight: number | null; reps: number | null };

function carriedInto(cursor: SetCursor): Prefill {
	const sets = cursor.exercise.sets;
	const at = sets.findIndex((s) => s.id === cursor.set.id);

	for (let i = at - 1; i >= 0; i--) {
		const set = sets[i];

		if (set.type === 'warmup' || set.weight === null || set.reps === null) {
			continue;
		}

		return { weight: set.weight, reps: set.reps };
	}

	return { weight: null, reps: null };
}

export function prefillFor(cursor: SetCursor, history: History): Prefill {
	const recalled = hintFor(history, cursor.exercise.exerciseId, cursor.workingIndex) ?? {
		weight: null,
		reps: null
	};

	const carried = carriedInto(cursor);

	// One rule for both numbers: what this session already says outranks what was planned for it.
	// The plan owned the reps here and read back a target heavier than the set just logged.
	return {
		weight: cursor.set.weight ?? carried.weight ?? recalled.weight,
		reps: cursor.set.reps ?? carried.reps ?? cursor.set.plannedReps ?? recalled.reps
	};
}

// Gates before Number(), whose wider dialect reads `1e3` and `0x10` as numbers.
const ENTRY = /^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/u;

// Every prefix of ENTRY — `-`, `.`, `8.` must stay typeable mid-entry.
const DRAFT = /^-?\d*(?:[.,]\d*)?$/u;

export function isEntryDraft(raw: string): boolean {
	return DRAFT.test(raw);
}

export function parseEntry(raw: string): number | null {
	const trimmed = raw.trim();

	return ENTRY.test(trimmed) ? Number(trimmed.replace(',', '.')) : null;
}

export function settle(value: number, min = 0, max = Infinity): number {
	return Math.min(max, Math.max(min, Math.round(value * 100) / 100));
}

export function canCommit(weight: number | null, reps: number | null): boolean {
	return weight !== null && reps !== null && reps > 0;
}

export function draftSet(workout: Workout, setId: string, values: Prefill): boolean {
	const cursor = cursorFor(workout, setId);

	if (cursor === null) {
		return false;
	}

	cursor.set.weight = values.weight;
	cursor.set.reps = values.reps;

	if (!canCommit(values.weight, values.reps)) {
		cursor.set.completed = false;
	}

	return true;
}

export function commitSet(workout: Workout, setId: string, weight: number, reps: number): boolean {
	const cursor = cursorFor(workout, setId);

	if (cursor === null) {
		return false;
	}

	cursor.set.weight = weight;
	cursor.set.reps = reps;
	cursor.set.completed = true;

	return true;
}

export function rateSet(workout: Workout, setId: string, rpe: number | null): boolean {
	const cursor = cursorFor(workout, setId);

	if (cursor === null) {
		return false;
	}

	cursor.set.rpe = isExertion(rpe) ? settleExertion(rpe) : null;

	return true;
}

export function markSet(workout: Workout, setId: string, completed: boolean): boolean {
	const cursor = cursorFor(workout, setId);

	if (cursor === null) {
		return false;
	}

	if (completed && !canCommit(cursor.set.weight, cursor.set.reps)) {
		return false;
	}

	cursor.set.completed = completed;

	return true;
}

const blankSet = (id: string): WorkoutSet => ({
	id,
	type: 'normal',
	plannedReps: null,
	weight: null,
	reps: null,
	rpe: null,
	completed: false
});

const blankExercise =
	(catalogId: string) =>
	(ids: ExerciseIds): WorkoutExercise => ({
		id: ids.exercise,
		exerciseId: catalogId,
		sets: ids.sets.map((id) => blankSet(id))
	});

export function addExerciseTo(
	workout: Workout,
	entryId: string,
	catalogId: string,
	ids: ExerciseIds
): WorkoutExercise | null {
	return addToTree(workout, entryId, ids, blankExercise(catalogId));
}

export function supersetWith(
	workout: Workout,
	entryId: string,
	catalogId: string,
	ids: ExerciseIds
): boolean {
	return supersetWithTree(workout, entryId, catalogId, ids, blankExercise(catalogId));
}

export function addSet(workout: Workout, exerciseId: string, id: string): WorkoutSet | null {
	const exercise = exerciseIn(workout, exerciseId);

	if (exercise === null) {
		return null;
	}

	const set = blankSet(id);

	exercise.sets.push(set);

	return set;
}

export function insertedSetCount(history: History, exerciseId: string): number {
	const performed = history[exerciseId];

	return performed === undefined ? 3 : performed.length;
}

export function addExercise(
	workout: Workout,
	exerciseId: string,
	ids: NewExerciseIds,
	after?: string
): WorkoutEntry | null {
	if (ids.sets.length === 0) {
		return null;
	}

	const entry: WorkoutEntry = { id: ids.entry, exercises: [blankExercise(exerciseId)(ids)] };

	const at = after === undefined ? -1 : workout.entries.findIndex((e) => e.id === after);

	if (at === -1) {
		workout.entries.push(entry);
	} else {
		workout.entries.splice(at + 1, 0, entry);
	}

	return entry;
}

export function replaceExercise(
	workout: Workout,
	exerciseId: string,
	catalogId: string,
	ids: ExerciseIds
): WorkoutExercise | null {
	if (ids.sets.length === 0) {
		return null;
	}

	for (const entry of workout.entries) {
		const at = entry.exercises.findIndex((e) => e.id === exerciseId);

		if (at === -1) {
			continue;
		}

		const exercise: WorkoutExercise = {
			id: ids.exercise,
			exerciseId: catalogId,
			sets: ids.sets.map((id) => blankSet(id))
		};

		entry.exercises[at] = exercise;

		return exercise;
	}

	return null;
}

export function repeatFrom(past: Workout, startedAt: number, mint: () => string): Workout {
	const entries: WorkoutEntry[] = [];

	for (const entry of past.entries) {
		const exercises: WorkoutExercise[] = [];

		for (const exercise of entry.exercises) {
			const working = exercise.sets.filter((set) => set.type !== 'warmup');

			if (working.length === 0) {
				continue;
			}

			const repeated: WorkoutExercise = {
				id: mint(),
				exerciseId: exercise.exerciseId,
				sets: working.map((set) => ({
					id: mint(),
					type: 'normal' as const,
					plannedReps: set.plannedReps,
					weight: null,
					reps: null,
					rpe: null,
					completed: false
				}))
			};

			if (exercise.restSeconds !== undefined) {
				repeated.restSeconds = exercise.restSeconds;
			}

			exercises.push(repeated);
		}

		if (exercises.length === 0) {
			continue;
		}

		entries.push({ id: mint(), exercises });
	}

	return { id: mint(), templateId: past.templateId ?? null, startedAt, entries };
}
