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

export type LoadMode = 'total' | 'per-hand' | 'unilateral';
export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export type Exercise = {
	id: string;
	name: string;
	equipment: string;
	loadMode: LoadMode;
};

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
				out.push({ set, exercise, workingIndex: set.type === 'warmup' ? -1 : working++ });
			}
		}
	}

	return out;
}

/** One exercise and its sets, session order preserved. */
export type SetGroup = { exerciseId: string; cursors: SetCursor[] };

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

		if (last !== undefined && last.cursors[0].exercise.id === cursor.exercise.id) {
			last.cursors.push(cursor);
		} else {
			out.push({ exerciseId: cursor.exercise.exerciseId, cursors: [cursor] });
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
