/**
 * The template domain slice: the planned tree and the copy-on-start rule.
 *
 * Plain TypeScript with zero framework imports, per STACK.md's standing rule.
 * The editor screen wraps this in `$state` the same way the workout screen
 * wraps its own slice, and nothing here knows it does.
 *
 * The tree is PRODUCT.md's, level for level: session → entries → exercises →
 * sets, an entry holding several exercises being a superset. The planning side
 * of that is `joinEntry` and `splitEntry` below, deliberately the same pair of
 * verbs the workout tree exposes — a plan that could not shape a superset would
 * be a plan that starts a session it cannot describe.
 *
 * A planned set prescribes reps only, and null is an open target. Weight is
 * never planned — progression is recall, never prescription — so a template
 * set has no weight field at all rather than an unused one.
 */

import type { Workout, WorkoutEntry } from './workout.ts';

export type TemplateSet = {
	id: string;
	/** Reps only, and null is an open target. Weight is never planned. */
	plannedReps: number | null;
};

export type TemplateExercise = {
	id: string;
	exerciseId: string;
	sets: TemplateSet[];
};

/** An entry holding more than one exercise is a superset — see the header. */
export type TemplateEntry = {
	id: string;
	exercises: TemplateExercise[];
};

export type Template = {
	id: string;
	name: string;
	/** Epoch ms. The list on Start orders by it, oldest first. */
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

/**
 * Whether a template still says nothing: no name, no exercises.
 *
 * The rule the editor's persistence gate reads — a blank template is never
 * written, so backing out of a mis-tapped "New template" leaves no record
 * behind and nothing for sync to carry. Whitespace is not a name; a template
 * called "&nbsp;" in the list would be a row that cannot be told apart from a
 * rendering bug.
 */
export function isBlank(template: Template): boolean {
	return template.name.trim() === '' && template.entries.length === 0;
}

/** How many sets a planned exercise arrives with. The gym's default shape. */
export const PLANNED_SET_COUNT = 3;

/**
 * What the first + on an open target proposes, rather than a 1 nobody ever
 * planned. Its sibling above, and here for the same reason: the editor's
 * exercise-wide stepper and its per-set steppers both propose it, and two
 * copies of the gym's default rep shape would drift.
 */
export const PLANNED_REPS = 8;

/** What a leg joining an entry needs. No entry id: it is joining one, not making one. */
export type ExerciseIds = { exercise: string; sets: string[] };

/**
 * The same, plus the entry a newly planned exercise stands in on its own —
 * composed rather than restated, the workout tree's spelling for the same pair.
 */
export type NewExerciseIds = ExerciseIds & { entry: string };

/**
 * Plans an exercise as a new entry at the end of the template. Null when no
 * set ids were provided: an exercise with no sets is not an exercise, the
 * same rule the workout tree enforces.
 *
 * At the end, always — the placement rule the workout's insert already
 * settled: predictable beats clever, and positioning is reorder's job.
 */
export function addExercise(
	template: Template,
	exerciseId: string,
	ids: NewExerciseIds
): TemplateEntry | null {
	if (ids.sets.length === 0) {
		return null;
	}

	const entry: TemplateEntry = {
		id: ids.entry,
		exercises: [
			{
				id: ids.exercise,
				exerciseId,
				sets: ids.sets.map((id) => ({ id, plannedReps: null }))
			}
		]
	};

	template.entries.push(entry);

	return entry;
}

/**
 * Plans an exercise as another leg of an entry that already exists — the fresh
 * half of "superset this with…", where the answer was something not yet in the
 * plan.
 *
 * The leg lands at the end of the entry, which is the order it will be lifted
 * in once `startFrom` copies the tree across. Its sets arrive as
 * `addExercise`'s do, open targets and all: nothing about being supersetted
 * prescribes a rep count.
 *
 * Null for an unknown entry and null for no set ids, `addExercise`'s refusals.
 */
export function addExerciseTo(
	template: Template,
	entryId: string,
	catalogId: string,
	ids: ExerciseIds
): TemplateExercise | null {
	const entry = template.entries.find((e) => e.id === entryId);

	if (entry === undefined || ids.sets.length === 0) {
		return null;
	}

	const exercise: TemplateExercise = {
		id: ids.exercise,
		exerciseId: catalogId,
		sets: ids.sets.map((id) => ({ id, plannedReps: null }))
	};

	entry.exercises.push(exercise);

	return exercise;
}

/**
 * Moves a planned exercise into `entryId`, making the two a superset — the
 * other half of "superset this with…", where the answer was already in the plan.
 *
 * Everything the exercise prescribes rides along: the 12/10/8 somebody sat down
 * to build was a decision about that movement, and pairing it with another one
 * is not a reason to forget it. The workout tree's `joinEntry` carries logged
 * sets across for the same reason, one tree over.
 *
 * The entry it came from goes with it when nothing is left there — the husk
 * rule `removeExercise` already keeps.
 *
 * False for an unknown entry, an unknown exercise, and one already standing in
 * this entry, the honest no-op `moveEntry` reports.
 */
export function joinEntry(template: Template, entryId: string, exerciseId: string): boolean {
	const target = template.entries.find((e) => e.id === entryId);

	if (target === undefined) {
		return false;
	}

	for (const [at, entry] of template.entries.entries()) {
		const index = entry.exercises.findIndex((e) => e.id === exerciseId);

		if (index === -1) {
			continue;
		}

		if (entry === target) {
			return false;
		}

		const [exercise] = entry.exercises.splice(index, 1);

		target.exercises.push(exercise);

		if (entry.exercises.length === 0) {
			template.entries.splice(at, 1);
		}

		return true;
	}

	return false;
}

/**
 * "Superset this with…", answered against the plan — the workout tree's
 * `supersetWith`, restated here for the reason `moveEntry` gives at the foot of
 * this file, and carrying the same rule.
 *
 * A pick naming something already planned elsewhere is that exercise moving in,
 * its targets riding along; anything else is planned fresh as another leg. The
 * choice is read off the template rather than off the row the pick came from,
 * so a shelf pinned above the catalog and a search result below it mean the
 * same thing when they name the same exercise.
 *
 * "Elsewhere" excludes this entry's own legs, so naming one of them plans a
 * second of it rather than doing nothing.
 */
export function supersetWith(
	template: Template,
	entryId: string,
	catalogId: string,
	ids: ExerciseIds
): boolean {
	const standing = template.entries
		.filter((entry) => entry.id !== entryId)
		.flatMap((entry) => entry.exercises)
		.find((exercise) => exercise.exerciseId === catalogId);

	if (standing !== undefined) {
		return joinEntry(template, entryId, standing.id);
	}

	return addExerciseTo(template, entryId, catalogId, ids) !== null;
}

/**
 * Breaks a planned superset back into one entry per exercise, in place and in
 * the order the legs stood in — the workout tree's `splitEntry`, restated
 * against this tree for the reason `moveEntry` gives at the foot of this file:
 * the two trees agree only by coincidence of shape.
 *
 * Nothing is lost. Every set and every target stays on the exercise that holds
 * it, and what changes is only that the legs stop being lifted in turn.
 *
 * The first leg keeps the entry, so an id the editor is holding stays valid.
 * The rest take fresh ones from `mint`, because ids key records and sync.
 *
 * False for an unknown entry and false for one that was never a superset.
 */
export function splitEntry(template: Template, entryId: string, mint: () => string): boolean {
	const at = template.entries.findIndex((e) => e.id === entryId);

	if (at === -1 || template.entries[at].exercises.length < 2) {
		return false;
	}

	const entry = template.entries[at];
	const [first, ...rest] = entry.exercises;

	entry.exercises = [first];

	template.entries.splice(
		at + 1,
		0,
		...rest.map((exercise) => ({ id: mint(), exercises: [exercise] }))
	);

	return true;
}

/**
 * Removes an exercise, and with it the entry it stood in when nothing else
 * does. The exercise `id` names a node of this tree, not a catalog entry.
 *
 * No minimum here, unlike sets: a template with no exercises is the blank
 * state the editor opens on, not a broken one. The entry going with its last
 * exercise is what keeps `entries` free of husks a reorder would drag around
 * as invisible rows.
 */
export function removeExercise(template: Template, exerciseId: string): boolean {
	for (const entry of template.entries) {
		const at = entry.exercises.findIndex((e) => e.id === exerciseId);

		if (at === -1) {
			continue;
		}

		entry.exercises.splice(at, 1);

		if (entry.exercises.length === 0) {
			template.entries.splice(template.entries.indexOf(entry), 1);
		}

		return true;
	}

	return false;
}

function exerciseIn(template: Template, exerciseId: string): TemplateExercise | null {
	for (const entry of template.entries) {
		for (const exercise of entry.exercises) {
			if (exercise.id === exerciseId) {
				return exercise;
			}
		}
	}

	return null;
}

/**
 * Swaps what a planned exercise prescribes, leaving the plan around it alone.
 *
 * The rack will be taken, so the slot is filled with something else — and the
 * slot here is more than a position: it is three sets of eight, or the 12/10/8
 * somebody sat down to build. All of it survives, because a template
 * prescribes a *shape* and the shape was never a fact about the old exercise.
 * Which is where this parts company with the workout's `replaceEntry`, whose
 * sets are rebuilt from scratch: there the sets are logged performances of one
 * specific lift, and carrying an 82.5 × 7 across would file it under something
 * nobody did. Nothing is performed here, so nothing is misfiled.
 *
 * Every id survives too — the exercise node's and each set's — so this takes
 * no minted ids at all. The node is the same slot holding a different lift,
 * the editor's `{#each}` keys straight through it, and a card mid-swap keeps
 * whatever its user had open.
 *
 * The exercise node, not the entry: an entry holding two of them is a
 * superset, and swapping one half of it is a swap of that half. `catalogId`
 * names a catalog exercise; `exerciseId` names a node of this tree.
 *
 * False for an unknown node, and false for a swap to what is already there —
 * the same honest no-op `moveEntry` reports.
 */
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

/**
 * Appends a planned set, carrying the target of the set above it.
 *
 * A copy and not the blank the workout's added set arrives as, because the
 * two screens answer different questions. Mid-workout, a copied plan would
 * put a number under the user's thumb that nobody prescribed; here the user
 * *is* the prescriber, a fourth set usually repeats the third's target, and
 * an unwanted copy is one step from open again — `setPlannedReps` walks back
 * to null through the floor.
 */
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

/**
 * Removes a planned set. False when the id is unknown, and false when it is
 * the only set its exercise has — an exercise with no sets left is a removed
 * exercise, which is `removeExercise`'s job, not a shorter one.
 */
export function removeSet(template: Template, setId: string): boolean {
	for (const entry of template.entries) {
		for (const exercise of entry.exercises) {
			const at = exercise.sets.findIndex((s) => s.id === setId);

			if (at === -1) {
				continue;
			}

			if (exercise.sets.length === 1) {
				return false;
			}

			exercise.sets.splice(at, 1);

			return true;
		}
	}

	return false;
}

/**
 * Writes a rep target, or clears it: null is the open target, and it is a
 * value here rather than a missing one so the editor's step-below-one gesture
 * has something honest to write.
 *
 * A target below one is refused rather than clamped — zero planned reps is
 * not a plan, and the editor expresses "no target" by passing null, never by
 * counting down to nonsense.
 */
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

/**
 * Writes one rep target across every set of an exercise.
 *
 * The editor's card prescribes at the exercise level — most plans want the same
 * number on all three sets, and stepping each of them to 8 in turn was the bulk
 * of what that screen asked for. Per-set targets are still writable one at a
 * time through `setPlannedReps`; this is the shared arm, and the editor only
 * offers it while the sets already agree, so it can never quietly flatten a
 * 12/10/8 the user built on purpose.
 *
 * Same refusal as `setPlannedReps` — a target below one is not a plan — and
 * null is the open target, applied to every set alike.
 */
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

/**
 * Moves an entry to `toIndex`, taking everything under it along — the same
 * rule, clamp and honest no-op as the workout tree's `moveEntry`, restated
 * against this tree rather than shared, because the two trees agree only by
 * coincidence of shape and a helper generic over both would weld them.
 */
export function moveEntry(template: Template, entryId: string, toIndex: number): boolean {
	const from = template.entries.findIndex((e) => e.id === entryId);

	if (from === -1) {
		return false;
	}

	const to = Math.min(Math.max(toIndex, 0), template.entries.length - 1);

	if (to === from) {
		return false;
	}

	const [entry] = template.entries.splice(from, 1);
	template.entries.splice(to, 0, entry);

	return true;
}

/**
 * Copy-on-start: the workout a template begins, per PRODUCT.md — a snapshot
 * of the template tree, so editing either afterwards never touches the other.
 *
 * Every node gets a fresh id from `mint` rather than carrying the template's:
 * ids key records and sync, the same workout started twice must be two
 * records, and a shared set id would let the store confuse a Tuesday with a
 * Thursday. `mint` is injected because this module has no randomness — a test
 * hands in a counter and the tree is fully predictable.
 *
 * Sets arrive as every workout set does — nothing logged, unchecked — with
 * the planned reps carried and weight null: the plan prescribed reps, and
 * weight is recall's business once the workout screen resolves its hints.
 * `templateId` is the one thread left between the trees, for the day the
 * planning surface asks whether a finished session drifted from its plan.
 */
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
				// A plan cannot prescribe how a set will feel, so a session always
				// starts unrated — the same reason weight arrives null below.
				rpe: null,
				weight: null,
				reps: null,
				completed: false
			}))
		}))
	}));

	return { id: mint(), templateId: template.id, startedAt, entries };
}
