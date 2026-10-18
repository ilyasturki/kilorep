import { z } from 'zod';

import type { Exercise } from '$lib/domain/exercise';
import { MAX_REST_SECONDS, MIN_REST_SECONDS } from '$lib/domain/rest';
import { settleGrip } from '$lib/domain/grip';
import { MARK_COLOURS, MARK_ICONS } from '$lib/domain/template';
import { foldedTo } from '$lib/store/fold';
import type { TemplateEntry, TemplateExercise } from '$lib/domain/template';
import type { WorkoutEntry, WorkoutExercise, WorkoutSet } from '$lib/domain/workout';

function mint(): string {
	return crypto.randomUUID();
}

/**
 * Supersets, said flatly.
 *
 * The domain nests — an entry holds the exercises trained together — but a caller writing
 * a plan out in one call would have to build that nesting to say a thing it mostly does not
 * mean. A number shared by two exercises says it instead, and the common case says nothing.
 */
const GROUP = z
	.number()
	.int()
	.min(1)
	.max(30)
	.optional()
	.describe('exercises sharing a number are supersetted into one entry; omit for a plain exercise');

const REST = z
	.number()
	.int()
	.min(MIN_REST_SECONDS)
	.max(MAX_REST_SECONDS)
	.nullable()
	.describe('seconds of rest here, or null to never rest; omit to inherit the exercise default');

type Grouped = { group?: number | undefined };

/**
 * Group numbers back into entries, first appearance deciding the order.
 *
 * Ids are minted fresh rather than carried from the caller: nothing outside a plan or a
 * session references its entry, exercise or set ids — drift matches on `exerciseId`, hints
 * and history key on it, and a workout points at its plan by the plan's own id — so a tree
 * rewritten wholesale stays the tree everything else was already reading.
 */
function entriesOf<T extends Grouped, E>(
	items: T[],
	build: (item: T) => E
): { id: string; exercises: E[] }[] {
	const entries: { id: string; exercises: E[] }[] = [];
	const open = new Map<number, { id: string; exercises: E[] }>();

	for (const item of items) {
		const built = build(item);
		const key = item.group;

		if (key === undefined) {
			entries.push({ id: mint(), exercises: [built] });

			continue;
		}

		const found = open.get(key);

		if (found === undefined) {
			const entry = { id: mint(), exercises: [built] };

			open.set(key, entry);
			entries.push(entry);
		} else {
			found.exercises.push(built);
		}
	}

	return entries;
}

/** Exercises a group names twice — a superset of a movement with itself, which a plan refuses. */
export function doubledInGroup(items: (Grouped & { exerciseId: string })[]): string[] {
	const seen = new Set<string>();
	const doubled = new Set<string>();

	for (const { group, exerciseId } of items) {
		if (group === undefined) {
			continue;
		}

		const key = `${group}:${exerciseId}`;

		if (seen.has(key)) {
			doubled.add(exerciseId);
		}

		seen.add(key);
	}

	return [...doubled];
}

const GRIP = z
	.string()
	.max(40)
	.describe(
		'which grip, attachment or handle — one of the ids the exercise’s `grips` axis lists; omit for its default. Recorded on the set; history, hints and bests read across every grip'
	);

const OPTIONAL = z
	.boolean()
	.describe(
		'true for an exercise the session may skip: the phone passes it by unless tapped, and leaving it out is never a deviation from the plan; omit for a required one'
	);

const ARMS = z
	.enum(['both', 'one'])
	.describe(
		'how many arms did the work; recorded only — it splits no history and factors no volume'
	);

type Restable = { restSeconds?: number | null };

/**
 * Entries flattened back into the rows a write takes — the inverse of `entriesOf`.
 *
 * Group numbers are minted here rather than carried: nothing outside the tree references an
 * entry id, so a superset is named by the only thing that survives a rewrite, which is two
 * exercises sharing a number. What a row says about its subject is the caller's to build.
 */
export function flatRows<E extends Restable>(
	entries: { exercises: E[] }[],
	build: (exercise: E) => Record<string, unknown>
): Record<string, unknown>[] {
	const rows: Record<string, unknown>[] = [];
	let group = 0;

	for (const entry of entries) {
		const superset = entry.exercises.length > 1;

		if (superset) {
			group += 1;
		}

		for (const exercise of entry.exercises) {
			const row = build(exercise);

			if (superset) {
				row.group = group;
			}

			if (exercise.restSeconds !== undefined) {
				row.restSeconds = exercise.restSeconds;
			}

			rows.push(row);
		}
	}

	return rows;
}

/**
 * A set as it is written back, nulls and all.
 *
 * `weight` and `reps` are nullable because a set that was never performed carries no
 * numbers: a session started from a plan and left unfinished keeps those rows, and the
 * read hands them back — so a schema demanding numbers would refuse the caller its own
 * `workout` output on the one tool that asks for the whole tree returned.
 */
export const PERFORMED_SET = z
	.object({
		weight: z
			.number()
			.min(0)
			.max(1000)
			.nullable()
			.describe(
				'kg on the bar, as loaded rather than as lifted; on an exercise with a bodyweightShare it is what was *added* to the body — a pull-up with nothing hanging off it is 0, never the lifter’s weight; null on a set never performed'
			),
		reps: z.number().int().min(0).max(1000).nullable(),
		type: z
			.enum(['normal', 'warmup', 'drop', 'failure'])
			.default('normal')
			.describe(
				'warmups are excluded from volume, personal bests, hints and rest; drop and failure sets count as working sets'
			),
		rpe: z.number().min(1).max(10).nullable().default(null).describe('1–10, half steps'),
		completed: z
			.boolean()
			.default(true)
			.describe('an uncompleted set stays in the record and counts towards nothing'),
		plannedReps: z.number().int().min(1).max(100).nullable().default(null),
		grip: GRIP.optional(),
		arms: ARMS.optional()
	})
	.refine(
		(set) => !set.completed || (set.weight !== null && set.reps !== null),
		'a completed set needs both a weight and reps — mark it completed: false to leave them out'
	);

export const PERFORMED_EXERCISE = z.object({
	exerciseId: z.string().describe('exercise id — resolve prose through search_exercises first'),
	group: GROUP,
	restSeconds: REST.optional(),
	grip: GRIP.optional(),
	plannedAs: z
		.string()
		.max(80)
		.optional()
		.describe(
			'the exercise id the plan had in this slot, when this exercise was swapped in for it; omit when it is what was planned'
		),
	optional: OPTIONAL.optional(),
	sets: z.array(PERFORMED_SET).min(1).max(30),
	note: z
		.string()
		.max(2000)
		.optional()
		.describe(
			'what was said about this exercise on this day; the app shows it again the next time the exercise is trained. Not the standing note set_exercise_note writes'
		)
});

export type PerformedInput = z.infer<typeof PERFORMED_EXERCISE>;

export function workoutEntriesOf(
	items: PerformedInput[],
	catalog: Record<string, Exercise>
): WorkoutEntry[] {
	return entriesOf(items, (item) => {
		const meta: Exercise | undefined = catalog[item.exerciseId];

		const exercise: WorkoutExercise = {
			id: mint(),
			exerciseId: item.exerciseId,
			sets: item.sets.map((set) => {
				const performed: WorkoutSet = {
					id: mint(),
					type: set.type,
					plannedReps: set.plannedReps,
					weight: set.weight,
					reps: set.reps,
					rpe: set.rpe,
					completed: set.completed
				};

				// Settled, not trusted: a grip the catalogue does not list would file the set under
				// a key no screen can reach again.
				const grip = settleGrip(meta, set.grip ?? item.grip);

				if (grip !== undefined) {
					performed.grip = grip;
				}

				if (set.arms === 'one') {
					performed.arms = 'one';
				}

				return performed;
			})
		};

		if (item.restSeconds !== undefined) {
			exercise.restSeconds = item.restSeconds;
		}

		const grip = settleGrip(meta, item.grip);

		if (grip !== undefined) {
			exercise.grip = grip;
		}

		const planned =
			item.plannedAs === undefined ? undefined : (foldedTo(item.plannedAs) ?? item.plannedAs);

		if (planned !== undefined && planned !== item.exerciseId) {
			exercise.plannedAs = planned;
		}

		if (item.optional === true) {
			exercise.optional = true;
		}

		const note = item.note === undefined ? '' : item.note.trim();

		if (note !== '') {
			exercise.note = note;
		}

		return exercise;
	});
}

export const PLANNED_EXERCISE = z.object({
	exerciseId: z.string().describe('exercise id — resolve prose through search_exercises first'),
	group: GROUP,
	restSeconds: REST.optional(),
	grip: GRIP.optional(),
	optional: OPTIONAL.optional(),
	sets: z
		.array(z.number().int().min(1).max(100).nullable())
		.min(1)
		.max(30)
		.describe('one target per set, e.g. [8, 8, 8]; null is an open target, which is the default')
});

export type PlannedInput = z.infer<typeof PLANNED_EXERCISE>;

export function templateEntriesOf(
	items: PlannedInput[],
	catalog: Record<string, Exercise>
): TemplateEntry[] {
	return entriesOf(items, (item) => {
		const exercise: TemplateExercise = {
			id: mint(),
			exerciseId: item.exerciseId,
			sets: item.sets.map((plannedReps) => ({ id: mint(), plannedReps }))
		};

		if (item.restSeconds !== undefined) {
			exercise.restSeconds = item.restSeconds;
		}

		const grip = settleGrip(catalog[item.exerciseId], item.grip);

		if (grip !== undefined) {
			exercise.grip = grip;
		}

		if (item.optional === true) {
			exercise.optional = true;
		}

		return exercise;
	});
}

export const MARK = z
	.object({
		icon: z.enum(MARK_ICONS).nullable(),
		colour: z.enum(MARK_COLOURS).nullable()
	})
	.describe('the badge the plan wears in lists');
