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
 * finish ceremony — that math answers to History and Dashboard, and writing it
 * here would be guessing at surfaces that have not been designed.
 */

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export type PerformedSet = { weight: number; reps: number };

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
 */
export function hintLabel(history: History, cursor: SetCursor): string | null {
	const hint = hintFor(history, cursor.exercise.exerciseId, cursor.workingIndex);

	return hint === null ? null : `${hint.weight} × ${hint.reps}`;
}

/** What the fields open at. Null in either slot means there is nothing to recall. */
export type Prefill = { weight: number | null; reps: number | null };

/**
 * Precedence: what the set already holds, then the plan, then last time.
 *
 * Reps take a planned value over the hint because a planned rep count is an
 * instruction for today and the hint is only a memory of the last one. Weight
 * has no planned tier by design — PRODUCT.md: progression is recall, never
 * prescription — so it falls straight from the set to the hint.
 */
export function prefillFor(cursor: SetCursor, history: History): Prefill {
	// Collapsed to a blank pair rather than null-checked twice below, so each
	// slot reads as the precedence chain the doc comment describes. (`?.` would
	// say it in one fewer line and is banned outside Svelte files.)
	const recalled = hintFor(history, cursor.exercise.exerciseId, cursor.workingIndex) ?? {
		weight: null,
		reps: null
	};

	return {
		weight: cursor.set.weight ?? recalled.weight,
		reps: cursor.set.reps ?? cursor.set.plannedReps ?? recalled.reps
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
 * A number the fields can show and the log can hold: floored at `min`, rounded
 * to the 0.01 that is the finest weight anything here displays.
 *
 * Shared because there are two ways into the same field — the ± arms and the
 * numpad — and a rule applied by one and not the other would let the field
 * disagree with itself about what the user just entered.
 */
export function settle(value: number, min = 0): number {
	return Math.max(min, Math.round(value * 100) / 100);
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
 * Writes exactly what it is given. PRODUCT.md is explicit that the check is an
 * affirmative claim rather than a silent acceptance of the hint, so the values
 * arrive from the caller — this function never reaches for a hint of its own.
 *
 * Mutates in place. The reactive shell holds the tree in a deep `$state` proxy
 * and sees the write; a test holds a plain object and sees it too.
 */
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
	completed: false
});

/**
 * Appends a working set to an exercise. Null when the exercise is not here.
 *
 * It arrives empty, and `plannedReps` is null rather than a copy of the set
 * above it. PRODUCT.md: an added set shows the hint where history has a
 * corresponding set and is blank otherwise — the fifth set of an exercise you
 * did four of last week is a set the app knows nothing about, and a plan copied
 * off its neighbour would put a number under the user's thumb that nobody
 * prescribed and nothing recalls.
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
 * Inserts an exercise as a new entry at the end of the session. Null when no
 * set ids were provided: an exercise with no sets is not an exercise, the same
 * rule `removeSet` enforces from the other side.
 *
 * At the end, always — the one placement rule, decided over insert-after-here.
 * Predictable beats clever mid-session, and positioning is reorder's job when
 * reorder lands, not a second thing insertion does.
 *
 * The sets arrive blank with `plannedReps: null`, not copied from anywhere:
 * nothing prescribed them — plans live in templates, and this exercise joined
 * after the template had its say. The hint path needs no help here: a blank
 * working set resolves its prefill from history by index, so an exercise
 * performed last week opens on last week's numbers untouched.
 *
 * A new entry rather than a slot in an existing one, because an entry holding
 * several exercises is a superset, and inserting into one is a superset edit —
 * a different gesture against a different level of the tree.
 */
export function addExercise(
	workout: Workout,
	exerciseId: string,
	ids: NewExerciseIds
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

	workout.entries.push(entry);

	return entry;
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
