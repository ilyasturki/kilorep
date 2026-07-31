/**
 * The reactive shell around the workout domain.
 *
 * Kept separate from `$lib/domain/workout` deliberately: that module is plain
 * TypeScript with zero framework imports, per STACK.md's standing rule, and
 * this file is the one place a rune touches the tree. Every rule it applies —
 * where the active set goes, what the fields open at, whether the check is
 * live — is imported, not reimplemented.
 *
 * Still in memory: this class holds the live tree and knows nothing of
 * IndexedDB. Persistence is the page's job — an `$effect` snapshots the tree
 * into the store on every change — and resume is the constructor accepting
 * yesterday's snapshot instead of minting a fresh workout. The separation is
 * deliberate: the store is async and this class is not, and an `await` inside
 * a commit would put a frame of latency inside the one-tap loop.
 */

// The list rules arrive aliased: this class exposes `addSet`, `addExercise`
// and `removeSet` of its own, and a bare call to the domain one from inside
// them would read like recursion.
import {
	addExercise as insertExercise,
	addSet as appendSet,
	advanceFrom,
	commitSet,
	cursorFor,
	cursors,
	draftSet,
	firstUncompleted,
	insertedSetCount,
	moveEntry as relocateEntry,
	prefillFor,
	removeEntry as dropEntry,
	removeSet as dropSet,
	replaceEntry
} from '$lib/domain/workout';
import type { History, Workout } from '$lib/domain/workout';

/** What a session starts from: the snapshot that survived an app kill. */
export type Resume = {
	workout: Workout;
	activeSetId: string | null;
};

/** Empty on purpose — with no templates yet, every workout begins as nothing. */
const emptyWorkout = (): Workout => ({
	id: crypto.randomUUID(),
	startedAt: Date.now(),
	entries: []
});

export class WorkoutSession {
	public workout: Workout = $state(emptyWorkout());

	/**
	 * The one active set. Null once nothing is left uncompleted, which is the
	 * finished state — the screen has no other way to be done, because PRODUCT.md
	 * gives finishing no ceremony to announce it.
	 *
	 * Also null on an empty session, honestly: a workout with no exercises has
	 * nothing owed. The screen reads that state off `entries` rather than here.
	 */
	public activeSetId: string | null = $state(null);

	/**
	 * The hint map, read once at construction. It only changes when a workout
	 * finishes, and finishing leaves this screen — so a session never needs to
	 * watch it move.
	 */
	private readonly history: History;

	/**
	 * Resuming replaces the field initialiser's empty tree with the snapshot,
	 * cursor and all — always and without asking, because a prompt in front of
	 * the logging loop is what rule 7 forbids, and a stale session is cleared
	 * by the same FINISH that clears a fresh one.
	 *
	 * The cursor arrives through `#focus` rather than by assignment, so a
	 * resumed set is seeded like any other. It is a no-op for a snapshot written
	 * since seeding landed — the set already holds what it opened at, and
	 * `prefillFor` reads that first.
	 */
	public constructor(history: History, resume: Resume | null = null) {
		this.history = history;

		if (resume !== null) {
			this.workout = resume.workout;
			this.#focus(resume.activeSetId);
		}
	}

	public get finished(): boolean {
		return this.activeSetId === null;
	}

	/** Whether anything was actually lifted — what decides if FINISH keeps a record. */
	public get hasLoggedSets(): boolean {
		return cursors(this.workout).some((c) => c.set.completed);
	}

	/** Overriding the advance: an overview jump, or a tap on a pending row. */
	public select(setId: string): void {
		this.#focus(setId);
	}

	/**
	 * The cursor, and the seeding that comes with it.
	 *
	 * Every route to a set goes through here — a tap, a rail jump, the advance
	 * after a commit, the cursor landing on load — because the seeding rule is
	 * "a set the cursor reaches opens on its prefill", and a route that set
	 * `activeSetId` directly would be a set that opened on nothing.
	 *
	 * `prefillFor` reads what the set already holds before it reaches for a plan
	 * or a hint, so this is idempotent: a set already drafted opens on its draft,
	 * and a logged set opens on what was logged. Nothing here can rewrite either.
	 *
	 * The write is deliberate rather than a display trick. The values are on the
	 * set, so the row shows them while the cursor is elsewhere — uncompleted, in
	 * its pending dress, because `completed` is the only thing that says a set
	 * happened and `draftSet` never touches it.
	 */
	#focus(setId: string | null): void {
		this.activeSetId = setId;

		if (setId === null) {
			return;
		}

		const cursor = cursorFor(this.workout, setId);

		if (cursor === null) {
			return;
		}

		draftSet(this.workout, setId, prefillFor(cursor, this.history));
	}

	/**
	 * An edit in the open editor, landing on the set rather than being held in
	 * the component that made it.
	 *
	 * Not a commit and not a partial one: `draftSet` leaves `completed` alone, so
	 * everything typed before the check is pressed is visible and survives a jump
	 * away, and none of it claims the set was performed.
	 */
	public draft(setId: string, weight: number | null, reps: number | null): void {
		draftSet(this.workout, setId, { weight, reps });
	}

	/**
	 * The check. One gesture, two effects — write the set, move on — and the
	 * reason a set costs one tap.
	 *
	 * It used to start a rest timer as well. Rest is deferred until it can
	 * arrive as something a user can switch off, so nothing here counts.
	 */
	public commit(weight: number, reps: number): void {
		const id = this.activeSetId;

		if (id === null || !commitSet(this.workout, id, weight, reps)) {
			return;
		}

		this.#focus(advanceFrom(this.workout, id)?.set.id ?? null);
	}

	/**
	 * One more set on an exercise, minted here because the domain has no
	 * randomness of its own.
	 *
	 * A session with nothing left owed has no active set, so the set just added
	 * becomes it — otherwise the one thing the user asked for would land on
	 * screen unreachable, under a finish block saying there was nothing to do.
	 */
	public addSet(exerciseId: string): void {
		const set = appendSet(this.workout, exerciseId, crypto.randomUUID());

		if (set !== null && this.activeSetId === null) {
			this.#focus(set.id);
		}
	}

	/**
	 * Mid-workout insert: a new entry at the end of the session, sets and ids
	 * minted here for the same reason `addSet`'s is. How many is
	 * `insertedSetCount`'s rule, read against the store-derived history the
	 * session was constructed with.
	 *
	 * The cursor goes to it, always. Adding an exercise mid-session is a
	 * statement about what is being done next, and it is the one insertion the
	 * user has to go looking for otherwise: the entry lands at the end of a
	 * session that is scrolled somewhere else entirely, so leaving the cursor
	 * behind means the answer to "add exercise" is a scroll.
	 */
	public addExercise(exerciseId: string): void {
		const count = insertedSetCount(this.history, exerciseId);

		const entry = insertExercise(this.workout, exerciseId, {
			entry: crypto.randomUUID(),
			exercise: crypto.randomUUID(),
			sets: Array.from({ length: count }, () => crypto.randomUUID())
		});

		if (entry !== null) {
			this.#focus(entry.exercises[0].sets[0].id);
		}
	}

	/**
	 * Swapping what is performed in an entry: the rack was taken.
	 *
	 * Set count from the incoming exercise's history, ids minted here, both for
	 * the same reasons `addExercise` above has them.
	 *
	 * The cursor follows only if it was inside the entry — where it has to, the
	 * set it was on having just left the tree — or if the session had nothing
	 * left owed. Swapping something further down the session while logging is
	 * not a statement about what is being done right now, and stealing the
	 * cursor for it would cost a jump back.
	 */
	public swapExercise(entryId: string, exerciseId: string): void {
		const active = this.activeSetId === null ? null : cursorFor(this.workout, this.activeSetId);
		const held = active === null || active.entry.id === entryId;

		const count = insertedSetCount(this.history, exerciseId);

		const entry = replaceEntry(this.workout, entryId, exerciseId, {
			exercise: crypto.randomUUID(),
			sets: Array.from({ length: count }, () => crypto.randomUUID())
		});

		if (entry !== null && held) {
			this.#focus(entry.exercises[0].sets[0].id);
		}
	}

	/**
	 * Removing an exercise, and everything logged under it.
	 *
	 * Same care `removeSet` takes with the cursor, one level up: the set above
	 * the *entry* is read before the removal, because `advanceFrom` handed the id
	 * of a set that has left the tree silently starts again from the top of the
	 * session and undoes whatever jump the user had made.
	 *
	 * `at` is the first set belonging to the entry, so the one above it is
	 * necessarily outside — there is no risk of measuring from a set that is
	 * about to be removed alongside it.
	 */
	public removeExercise(entryId: string): void {
		const all = cursors(this.workout);
		const at = all.findIndex((c) => c.entry.id === entryId);
		const above = at > 0 ? all[at - 1].set.id : null;
		const held = all.some((c) => c.entry.id === entryId && c.set.id === this.activeSetId);

		if (!dropEntry(this.workout, entryId) || !held) {
			return;
		}

		const next = above === null ? firstUncompleted(this.workout) : advanceFrom(this.workout, above);

		this.#focus(next?.set.id ?? null);
	}

	/**
	 * Reordering the session, from a drag on the session list.
	 *
	 * The cursor is deliberately not touched. Reordering is not a jump — the set
	 * being logged is still the set being logged, wherever its exercise has
	 * landed — and what changes is only what `advanceFrom` finds next, because
	 * that rule reads position at the moment it is asked rather than caching one.
	 */
	public moveEntry(entryId: string, index: number): void {
		relocateEntry(this.workout, entryId, index);
	}

	/**
	 * Removing the active set has to leave the cursor somewhere, and the honest
	 * answer is where the advance would have put it: the next set still owed
	 * *after this position*, then the earliest gap left behind, then nowhere.
	 *
	 * Which is why the neighbour above is read before the removal rather than
	 * after: `advanceFrom` measures from a set that is still in the tree, and
	 * handed the id of one that has just left it, it silently starts again from
	 * the top of the session — undoing whatever jump the user had made.
	 */
	public removeSet(setId: string): void {
		const all = cursors(this.workout);
		const at = all.findIndex((c) => c.set.id === setId);
		const above = at > 0 ? all[at - 1].set.id : null;

		if (!dropSet(this.workout, setId)) {
			return;
		}

		if (this.activeSetId !== setId) {
			return;
		}

		const next = above === null ? firstUncompleted(this.workout) : advanceFrom(this.workout, above);

		this.#focus(next?.set.id ?? null);
	}
}

/**
 * The one live session, or null while nothing is being logged.
 *
 * It exists because the workout page is no longer the session's only reader:
 * both nav bars swap Start for Workout while one is live, and `/start`
 * reroutes into it. A session constructed inside the page died with the page —
 * walking to Exercises mid-workout threw the whole workout away, silently.
 *
 * A property on a stable instance rather than a reassigned `$state` export,
 * because the compiler transforms state references file by file and cannot
 * follow a reassignment across a module boundary — mutating a field of an
 * export that never moves is the shape it can track.
 *
 * Begun by the workout screen on entry, ended by FINISH. The holder itself is
 * memory only — the snapshot in the store is what survives a reload, and the
 * workout screen resuming from it is what refills this on the way back in.
 */
class ActiveWorkout {
	public session: WorkoutSession | null = $state(null);

	public begin(history: History, resume: Resume | null = null): WorkoutSession {
		this.session = new WorkoutSession(history, resume);

		return this.session;
	}

	public finish(): void {
		this.session = null;
	}
}

export const activeWorkout = new ActiveWorkout();
