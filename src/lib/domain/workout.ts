/**
 * The workout domain slice: the tree, the hint rule, the commit rule and the
 * advance rule.
 *
 * Plain TypeScript with zero framework imports, per STACK.md's standing rule.
 * The reactive shell that wraps it lives in `$lib/workout/session.svelte.ts`,
 * and nothing here knows it exists.
 *
 * Deliberately narrow: only what the workout screen needs. Volume and raw-PR
 * math are absent because PRODUCT.md gives this screen no running total and no
 * finish ceremony — that math answers to History and the Dashboard, and lives
 * where they read it: `$lib/domain/stats` and `$lib/domain/dashboard`.
 */

import { exertionSuffix, isExertion, settleExertion } from './exertion.ts';
import type { ExertionScale } from './exertion.ts';

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

/**
 * A set as it was performed. `rpe` rides along null far more often than not —
 * rating is optional and nothing ever fills it in — and it is here rather than
 * only on `WorkoutSet` because the recall line quotes it: "last time" is a
 * `PerformedSet`, and a recall that could not say how the set felt would have
 * to go back to the tree for it.
 */
export type PerformedSet = { weight: number; reps: number; rpe: number | null };

/**
 * The working sets of the last time each exercise was performed, in order.
 *
 * A record and not the full past-workout tree: the hint is the only thing this
 * screen asks of history, and the real shape of stored history is a question
 * for the store, which does not exist yet. An exercise absent from this map has
 * never been performed — the first-workout state, which is every exercise for
 * every new user, since PRODUCT.md refuses a v1 import.
 */
export type History = Record<string, PerformedSet[] | undefined>;

export type WorkoutSet = {
	id: string;
	type: SetType;
	/** Reps only, and null is an open target. Weight is never planned. */
	plannedReps: number | null;
	weight: number | null;
	reps: number | null;
	/**
	 * How hard it was, on the stored RPE scale — null for the vast majority of
	 * sets, which is the point.
	 *
	 * Optional in the only sense that matters: nothing prompts for it, nothing
	 * waits on it, and `canCommit` does not read it. MARKET.md refuses mandatory
	 * subjective input by name, so a rating exists only where a thumb put one
	 * there. RIR is the same number spoken from the other end — see
	 * `$lib/domain/exertion`, which owns the scale and never lets the record
	 * hold a unit.
	 *
	 * Readers tolerate records written before the field existed: absent reads as
	 * unrated, the same tolerance `templateId` has.
	 */
	rpe: number | null;
	completed: boolean;
};

export type WorkoutExercise = {
	id: string;
	exerciseId: string;
	sets: WorkoutSet[];
};

/**
 * An entry holding more than one exercise is a superset.
 *
 * The level is modelled even though supersets are out of this build's UI. It
 * is the shape PRODUCT.md fixes (session → entries → exercises → sets) and the
 * shape the server schema is waiting on; adding it later means reshaping the
 * tree everything else has already been written against.
 */
export type WorkoutEntry = {
	id: string;
	exercises: WorkoutExercise[];
};

export type Workout = {
	id: string;
	/**
	 * The template this session was started from, or null for an empty start.
	 *
	 * Carried on the record from birth because records sync and are effectively
	 * forever: the drift-vs-template surface PRODUCT.md plans reads this link,
	 * and a workout logged without it could never be compared to its plan.
	 * Readers tolerate records written before the field existed — absent reads
	 * as null, an empty start.
	 */
	templateId: string | null;
	/** Epoch ms. Every elapsed figure derives from this, never from a counter. */
	startedAt: number;
	entries: WorkoutEntry[];
};

/**
 * A set plus everything needed to reason about it, resolved once. Callers ask
 * for a cursor rather than walking the tree, so the "which index am I" rules
 * live in one place.
 */
export type SetCursor = {
	set: WorkoutSet;
	exercise: WorkoutExercise;
	/**
	 * The entry the exercise was performed under, and the level reorder moves.
	 *
	 * Carried rather than looked up, because the only caller that needs it is a
	 * drag reading it off a row it already has — and searching the tree for the
	 * entry containing an exercise node is the kind of lookup that goes ambiguous
	 * the day an entry holds two of them.
	 */
	entry: WorkoutEntry;
	/** Index among this exercise's *working* sets; -1 for a warmup. */
	workingIndex: number;
};

/** Every set in session order, flattened. */
export function cursors(workout: Workout): SetCursor[] {
	const out: SetCursor[] = [];

	for (const entry of workout.entries) {
		for (const exercise of entry.exercises) {
			// Warmups are excluded from the count rather than merely skipped: the
			// hint for working set 1 is last time's working set 1, and a warmup
			// sitting above it must not push that lookup off by one.
			let working = 0;

			for (const set of exercise.sets) {
				out.push({ set, exercise, entry, workingIndex: set.type === 'warmup' ? -1 : working++ });
			}
		}
	}

	return out;
}

/**
 * One exercise and its sets, session order preserved. `id` is the
 * workout-exercise *node* id, not the catalog id: the same exercise performed
 * twice in one session is two groups, so only the node id can tell them apart
 * — or key a rendered list of them.
 *
 * `entryId` is what a reorder acts on, and it is deliberately not the group's
 * own identity: a superset entry produces two groups that share one `entryId`,
 * so dragging either of them moves the pair. That is the correct answer — the
 * two halves of a superset are performed together and must not be torn apart.
 */
export type SetGroup = {
	id: string;
	exerciseId: string;
	entryId: string;
	cursors: SetCursor[];
};

/**
 * Cursors grouped per exercise.
 *
 * Grouped by walking rather than by a map, because session order is the one
 * thing that must survive — an entry can hold two exercises (a superset) and
 * they belong adjacent, not merged. The same exercise performed twice in one
 * session is therefore two groups, not one.
 */
export function groupsOf(workout: Workout): SetGroup[] {
	const out: SetGroup[] = [];

	for (const cursor of cursors(workout)) {
		const last = out.at(-1);

		if (last !== undefined && last.id === cursor.exercise.id) {
			last.cursors.push(cursor);
		} else {
			out.push({
				id: cursor.exercise.id,
				exerciseId: cursor.exercise.exerciseId,
				entryId: cursor.entry.id,
				cursors: [cursor]
			});
		}
	}

	return out;
}

export function cursorFor(workout: Workout, setId: string): SetCursor | null {
	return cursors(workout).find((c) => c.set.id === setId) ?? null;
}

export function firstUncompleted(workout: Workout): SetCursor | null {
	return cursors(workout).find((c) => !c.set.completed) ?? null;
}

/**
 * Where the active set goes after `setId` is committed.
 *
 * Forward from the set just logged, not from the top of the session. Both
 * orders agree on the linear path; they disagree the moment the user has
 * jumped ahead via the overview, and sending them back to an earlier gap they
 * chose to leave open would undo the jump they just made. PRODUCT.md has no
 * skip state — an unchecked set simply stays uncompleted — so leaving gaps
 * behind is ordinary use and must not be fought.
 *
 * Falling back to the earliest remaining gap once the tail is exhausted is what
 * makes those sets reachable again without an explicit tap. Null means every
 * set in the workout is done.
 */
export function advanceFrom(workout: Workout, setId: string): SetCursor | null {
	const all = cursors(workout);
	// An unknown id leaves `at` at -1, so the tail is the whole session and the
	// answer collapses to the earliest gap — the same place the fallback lands.
	const at = all.findIndex((c) => c.set.id === setId);

	const ahead = all.slice(at + 1).find((c) => !c.set.completed);

	// `firstUncompleted` inlined rather than called: the array is already walked.
	return ahead ?? all.find((c) => !c.set.completed) ?? null;
}

export function hintFor(
	history: History,
	exerciseId: string,
	workingIndex: number
): PerformedSet | null {
	// Also true of `arr[-1]`, but stated rather than relied on: -1 is the warmup
	// sentinel, and "a warmup has no hint" is a rule, not an indexing accident.
	if (workingIndex < 0) {
		return null;
	}

	const performed = history[exerciseId];

	if (performed === undefined) {
		return null;
	}

	return performed[workingIndex] ?? null;
}

/**
 * Last time as the screen spells it, or null when there is nothing to recall.
 *
 * The `×` is a character rather than an `x` because the vendored font subset
 * carries it, and the phrasing is shown in two places at once — beside the
 * active set and down the pending rows. One owner, so they cannot disagree.
 *
 * `scale` grows the line by how the set felt, where last time carried a rating:
 * `82.5 × 7 · RPE 8`. Passed in rather than read from anywhere, because which
 * of the two names it wears is a preference and this module is plain domain —
 * and null is the honest way to ask for the numbers alone, which is what a
 * caller with no user in front of it (a test, an export) wants.
 */
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

/** What the fields open at. Null in either slot means there is nothing to recall. */
export type Prefill = { weight: number | null; reps: number | null };

/**
 * The pair on the nearest working set above this one in the same exercise, or
 * blanks when there is none.
 *
 * Both slots or neither. A weight taken from one set and a rep count from
 * another is a set nobody performed, and the whole worth of carrying is that
 * the row opens on something that was actually done — so a set is a candidate
 * only once it holds both numbers, which is every set the cursor has reached
 * and no set it has not.
 *
 * Warmups are skipped rather than merely ranked below: 40 × 10 off the bar is
 * not a suggestion for a working set, and it is the same off-by-one the hint
 * lookup counts past.
 */
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

/**
 * Precedence: what the set already holds, then the plan, then the set above
 * it, then last time.
 *
 * Reps take a planned value over everything because a planned rep count is an
 * instruction for today, and neither the set just done nor the memory of last
 * week outranks an instruction. Weight has no planned tier by design —
 * PRODUCT.md: progression is recall, never prescription — so it falls straight
 * from the set to the carry.
 *
 * The carry sits *above* the recall: mid-exercise, the number that answers
 * "what is this set" is the one just lifted at the bench being lifted at, not
 * last week's entry at the same index. Recall-first was tried and it made the
 * cursor argue with the session — log set one at 45 after a hint of 40, and
 * set two reopened on 40, presenting the user's own decision of a minute ago
 * as something to re-enter. The recall keeps the two places carry cannot
 * reach: the first working set, which has nothing above it to carry, and a set
 * following only warmups. And it keeps the label — "Last 40 × 10" stays
 * printed beside the card either way, memory as reference rather than as
 * prefill.
 */
export function prefillFor(cursor: SetCursor, history: History): Prefill {
	// Collapsed to a blank pair rather than null-checked twice below, so each
	// slot reads as the precedence chain the doc comment describes. (`?.` would
	// say it in one fewer line and is banned outside Svelte files.)
	const recalled = hintFor(history, cursor.exercise.exerciseId, cursor.workingIndex) ?? {
		weight: null,
		reps: null
	};

	const carried = carriedInto(cursor);

	return {
		weight: cursor.set.weight ?? carried.weight ?? recalled.weight,
		reps: cursor.set.reps ?? cursor.set.plannedReps ?? carried.reps ?? recalled.reps
	};
}

/**
 * A typed string to a number, or null when it is not an affirmative claim.
 *
 * Empty, a lone dot, a pasted word — none of them are a value the user stated,
 * so the caller keeps what it had rather than guessing. A comma is a decimal
 * point: the pad and the keyboard both produce one, depending on the locale.
 */
export function parseEntry(raw: string): number | null {
	const parsed = Number(raw.trim().replace(',', '.'));

	return raw.trim() === '' || !Number.isFinite(parsed) ? null : parsed;
}

/**
 * A number the fields can show and the log can hold: held between `min` and
 * `max`, rounded to the 0.01 that is the finest weight anything here displays.
 *
 * Shared because there are two ways into the same field — the ± arms and the
 * numpad — and a rule applied by one and not the other would let the field
 * disagree with itself about what the user just entered.
 *
 * `max` defaults to open, because a weight has no ceiling and never did. It is
 * here for the one field that does: a rating cannot exceed the top of its
 * scale, and a stepper that would carry it past 10 is offering a value the
 * record refuses.
 */
export function settle(value: number, min = 0, max = Infinity): number {
	return Math.min(max, Math.max(min, Math.round(value * 100) / 100));
}

/**
 * Whether the check is live, given the values currently on screen.
 *
 * Takes the live edit values rather than the prefill, and the distinction is
 * the whole no-history case: with nothing to recall, `weight` opens null and
 * stays null until the user says otherwise, so a zero nobody typed can never be
 * committed. Where there *is* something to recall both slots arrive filled and
 * the check is live on the first frame — that is the one-tap set the loop is
 * built on.
 *
 * Zero is a real weight (a bodyweight set), so the test is null and not falsy.
 */
export function canCommit(weight: number | null, reps: number | null): boolean {
	return weight !== null && reps !== null && reps > 0;
}

/**
 * Writes values onto a set without claiming them.
 *
 * Exactly what it is given, never a hint of its own: PRODUCT.md is explicit
 * that the check is an affirmative claim rather than a silent acceptance of the
 * recall, so the values arrive from the caller.
 *
 * The set is what holds the numbers being worked on, not the editor. A set the
 * cursor has reached opens on its prefill and keeps whatever was nudged into
 * it, so leaving it for another exercise and coming back finds the same two
 * numbers — and the row shows them meanwhile, in its pending dress, because a
 * number on screen that vanished when you looked away was never trustworthy.
 *
 * Both slots every time, nulls included: the caller holds the pair, and a patch
 * that skipped nulls could never take a value back out of a set.
 *
 * Which is the one case where `completed` moves, and it only ever moves *down*.
 * A set that no longer holds both numbers cannot go on saying it happened — it
 * would be a claim about nothing, and `markSet` already refuses to make that
 * claim on the way in, so allowing one out through here would leave the tree
 * holding a state nothing else in the app can produce. Claiming stays
 * `commitSet`'s alone.
 *
 * Mutates in place. The reactive shell holds the tree in a deep `$state` proxy
 * and sees the write; a test holds a plain object and sees it too.
 */
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

/**
 * Rates a set, or takes the rating back off it with null.
 *
 * Its own function and not a slot in `draftSet` or an argument to `commitSet`,
 * because it answers to none of their rules: it can be applied before the check
 * or long after it, it never touches `completed` in either direction, and a set
 * holding nothing but a rating is an ordinary uncompleted set rather than a
 * claim about nothing. The check is deliberately blind to it — MARKET.md
 * refuses mandatory subjective input, so nothing here can ever hold the loop up.
 *
 * `settleExertion` on the way in, applied to every route rather than trusted to
 * the picker: the chips can only produce rungs, but the stepper arms and a
 * payload from another device can produce anything, and a record is forever.
 *
 * Mutates in place, like every other writer here — the reactive shell holds the
 * tree in a deep `$state` proxy and sees the write, and a test holds a plain
 * object and sees it too.
 */
export function rateSet(workout: Workout, setId: string, rpe: number | null): boolean {
	const cursor = cursorFor(workout, setId);

	if (cursor === null) {
		return false;
	}

	// `isExertion` and not a bare null test: a caller reading a rating off an
	// untrusted payload can hand this a NaN, and `settleExertion` would clamp
	// that to the floor and file it as a deliberate RPE 1. It answers false for
	// null too, so there is no second test to keep in step with it.
	cursor.set.rpe = isExertion(rpe) ? settleExertion(rpe) : null;

	return true;
}

/**
 * Sets or clears the affirmative claim, leaving the numbers where they are.
 *
 * The correction `commitSet` cannot make, because it only ever claims — and a
 * set checked by mistake is exactly as ordinary a mistake as a number typed
 * wrong. Both screens that hold a workout reach it: history's edit mode, where
 * the tap that fixes it is the disc itself, and the live session, where it is
 * Unlog in the set's own options — see `WorkoutSession.unlogSet`. The live
 * screen went without one for a while on the theory that a set logged by
 * mistake would simply be removed, which asked the gym floor to destroy a row
 * in order to correct it.
 *
 * Claiming needs both numbers — `canCommit`'s rule, the same one that holds the
 * check inert. A set saying it happened without saying what happened is a
 * record of nothing, and it would count toward volume as a bodyweight zero.
 * Clearing never refuses: whatever the set holds stays on it, uncompleted, the
 * way a drafted set has always looked.
 */
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

/** The exercise `id` names a node of this tree, not a catalog entry. */
function exerciseIn(workout: Workout, exerciseId: string): WorkoutExercise | null {
	for (const entry of workout.entries) {
		for (const exercise of entry.exercises) {
			if (exercise.id === exerciseId) {
				return exercise;
			}
		}
	}

	return null;
}

/** What every set arrives as: nothing prescribed, nothing logged, unchecked. */
const blankSet = (id: string): WorkoutSet => ({
	id,
	type: 'normal',
	plannedReps: null,
	weight: null,
	reps: null,
	rpe: null,
	completed: false
});

/**
 * Appends a working set to an exercise. Null when the exercise is not here.
 *
 * It arrives empty, and `plannedReps` stays null rather than becoming a copy of
 * the set above it. Nothing prescribed this set: plans live in templates, and a
 * plan invented here would be the app claiming a target nobody set.
 *
 * What the row *opens* on is a different question, and `prefillFor` answers it:
 * the hint where history has a corresponding set, the set above it where it
 * does not. The fifth set of an exercise you did four of last week is a set the
 * app has no memory of, and the honest fallback is the fourth one you just did
 * — carried as values, never as a plan, so nothing here claims it was intended.
 *
 * The id is the caller's. This module has no clock and no randomness — the same
 * reason `freshWorkout` is handed its `startedAt` — and minting at the edge is
 * where it belongs anyway, since the store that will own these records keys
 * them by id and syncs them by it.
 */
export function addSet(workout: Workout, exerciseId: string, id: string): WorkoutSet | null {
	const exercise = exerciseIn(workout, exerciseId);

	if (exercise === null) {
		return null;
	}

	const set = blankSet(id);

	exercise.sets.push(set);

	return set;
}

/**
 * How many sets an inserted exercise arrives with: as many as last time, else
 * three. Last time's count is what the hints line up under, and where nothing
 * recalls anything, three is the gym's default shape rather than a burden of
 * one-by-one adds.
 */
export function insertedSetCount(history: History, exerciseId: string): number {
	const performed = history[exerciseId];

	return performed === undefined ? 3 : performed.length;
}

/** Every node an inserted exercise needs, minted by the caller — see `addSet`. */
export type NewExerciseIds = { entry: string; exercise: string; sets: string[] };

/**
 * Inserts an exercise as a new entry. Null when no set ids were provided: an
 * exercise with no sets is not an exercise, the same rule `removeSet` enforces
 * from the other side.
 *
 * `after` is the entry the new one lands behind — where the ask was made, which
 * on the workout pane is the block whose add row was tapped. Omitted, it lands
 * at the end.
 *
 * End-always was the rule here for a while, and the argument was that
 * positioning is reorder's job when reorder lands. Reorder has landed, which
 * retires that argument on its own terms: a pane that can be dragged into order
 * does not need insertion to stay dumb, and an exercise appearing at the foot of
 * a session scrolled somewhere else is a drag the user did not ask to perform.
 * The tap said where.
 *
 * An unknown or absent `after` falls to the end rather than refusing —
 * `moveEntry` shows the same forgiveness when it clamps a drag held past the
 * last row. Nothing here can fail for a placement the caller half-remembered.
 *
 * The entry and not the exercise, because an entry holding two of them is a
 * superset performed together: landing between the halves of one would be a
 * superset edit, a different gesture against a level of the tree the UI does not
 * expose.
 *
 * The sets arrive blank with `plannedReps: null`, not copied from anywhere:
 * nothing prescribed them — plans live in templates, and this exercise joined
 * after the template had its say. The hint path needs no help here: a blank
 * working set resolves its prefill from history by index, so an exercise
 * performed last week opens on last week's numbers untouched.
 *
 * A new entry rather than a slot in an existing one, for the superset reason
 * above read from the other side: inserting into one is that same edit.
 */
export function addExercise(
	workout: Workout,
	exerciseId: string,
	ids: NewExerciseIds,
	after?: string
): WorkoutEntry | null {
	if (ids.sets.length === 0) {
		return null;
	}

	const entry: WorkoutEntry = {
		id: ids.entry,
		exercises: [
			{
				id: ids.exercise,
				exerciseId,
				sets: ids.sets.map((id) => blankSet(id))
			}
		]
	};

	const at = after === undefined ? -1 : workout.entries.findIndex((e) => e.id === after);

	if (at === -1) {
		workout.entries.push(entry);
	} else {
		workout.entries.splice(at + 1, 0, entry);
	}

	return entry;
}

/** The nodes a replacement needs. No entry id: the entry itself survives a swap. */
export type ReplacementIds = { exercise: string; sets: string[] };

/**
 * Swaps what is performed in an entry, leaving the entry where it is.
 *
 * The rack was taken, so you do something else in the slot you had. The entry
 * is that slot: its id and its position in the session both survive, which is
 * what keeps a swap out of reorder's business — the alternative, remove and
 * add, drops the exercise at the end of the session and makes the user drag it
 * back.
 *
 * Everything below the entry is new. The sets are blank and counted by the
 * *incoming* exercise's history, exactly as if it had been added fresh, because
 * the sets that were there answered to a different exercise: four sets of bench
 * is not a prescription for four sets of incline press, and a logged 82.5 × 7
 * carried across would be the app filing a set under something nobody
 * performed. Callers with logged sets in hand are expected to have asked first.
 *
 * Null for an unknown entry and null for no set ids, the same refusals
 * `addExercise` makes.
 */
export function replaceEntry(
	workout: Workout,
	entryId: string,
	exerciseId: string,
	ids: ReplacementIds
): WorkoutEntry | null {
	const entry = workout.entries.find((e) => e.id === entryId);

	if (entry === undefined || ids.sets.length === 0) {
		return null;
	}

	entry.exercises = [
		{
			id: ids.exercise,
			exerciseId,
			sets: ids.sets.map((id) => blankSet(id))
		}
	];

	return entry;
}

/**
 * Removes an entry and everything under it, logged or not.
 *
 * No floor, unlike `removeSet`: a session with no entries left is an ordinary
 * state — it is what every session starts as before the first exercise is
 * added — so there is nothing here to refuse. What a *set* cannot do is leave
 * its exercise empty, because an exercise with no sets is not a shorter
 * exercise; an empty session is just an empty session.
 *
 * The entry and not the exercise, for the reason `moveEntry` gives: an entry
 * holding two of them is a superset, and taking one half out is a superset edit
 * against a level of the tree the UI does not expose.
 */
export function removeEntry(workout: Workout, entryId: string): boolean {
	const at = workout.entries.findIndex((e) => e.id === entryId);

	if (at === -1) {
		return false;
	}

	workout.entries.splice(at, 1);

	return true;
}

/**
 * Removes a set, logged or not. False when the id is unknown, and false when it
 * is the only set its exercise has: an exercise with no sets left is not a
 * shorter exercise, it is a removed one, and that is a different action against
 * a different level of the tree.
 */
export function removeSet(workout: Workout, setId: string): boolean {
	for (const entry of workout.entries) {
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
 * Moves an entry to `toIndex`, taking everything under it along.
 *
 * The entry and not the exercise, because an entry holding two exercises is a
 * superset and the pair is performed together — a reorder that could land one
 * half three exercises away from the other is not a reorder, it is a different
 * edit against a level of the tree the UI does not expose.
 *
 * Session order is the only thing that changes. Nothing here touches which set
 * is active: the cursor is held by id, and `advanceFrom` reads position at the
 * moment it is asked, so a move quietly changes what comes next — which is
 * exactly what reordering a session means.
 *
 * `toIndex` is clamped rather than refused. It arrives from pointer geometry
 * measured against row midpoints, and a drag held past the last row is an
 * unambiguous request to put the entry at the end; failing it over a rounding
 * error would refuse a move the user plainly made.
 *
 * Reports whether it moved, so a caller need not diff the tree to find out.
 * False for an unknown id and false for a move that lands where it started —
 * the same honest no-op `nudge` returns at the floor of a stepper.
 */
export function moveEntry(workout: Workout, entryId: string, toIndex: number): boolean {
	const from = workout.entries.findIndex((e) => e.id === entryId);

	if (from === -1) {
		return false;
	}

	const to = Math.min(Math.max(toIndex, 0), workout.entries.length - 1);

	if (to === from) {
		return false;
	}

	const [entry] = workout.entries.splice(from, 1);
	workout.entries.splice(to, 0, entry);

	return true;
}

/**
 * Copy-on-repeat: the session a finished workout begins again — PRODUCT.md's
 * "Repeat this workout", the History detail's one way to start something.
 *
 * Structure only, never performance. Working sets return blank with the
 * planned reps carried: the plan was a prescription and prescriptions repeat,
 * but weight and reps were what happened that day, and recall is the hint
 * path's job — a prefilled number nobody entered today could be committed by
 * habit. Warmups are dropped rather than copied, the same reason a template
 * plans none: the ramp-in is decided on the floor. Drop and failure sets come
 * back as normal sets — how a set *went* is not part of what was planned.
 *
 * An exercise whose sets were all warmups has no structure to repeat and is
 * not carried; an entry left with no exercises goes with it, the husk rule
 * `removeExercise` already enforces on the template tree.
 *
 * Every id is fresh from `mint`, `startFrom`'s rule for the same reason: the
 * same workout repeated twice must be two records. `templateId` rides along —
 * a repeated session still answers to the plan its original answered to — and
 * `??` tolerates records written before the field existed.
 */
export function repeatFrom(past: Workout, startedAt: number, mint: () => string): Workout {
	const entries: WorkoutEntry[] = [];

	for (const entry of past.entries) {
		const exercises: WorkoutExercise[] = [];

		for (const exercise of entry.exercises) {
			const working = exercise.sets.filter((set) => set.type !== 'warmup');

			if (working.length === 0) {
				continue;
			}

			exercises.push({
				id: mint(),
				exerciseId: exercise.exerciseId,
				sets: working.map((set) => ({
					id: mint(),
					type: 'normal' as const,
					plannedReps: set.plannedReps,
					weight: null,
					reps: null,
					// Dropped with the weight and the reps, and for the same reason:
					// how a set felt is what happened that day, not what was planned.
					rpe: null,
					completed: false
				}))
			});
		}

		if (exercises.length === 0) {
			continue;
		}

		entries.push({ id: mint(), exercises });
	}

	return { id: mint(), templateId: past.templateId ?? null, startedAt, entries };
}
