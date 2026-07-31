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
	cursors,
	firstUncompleted,
	insertedSetCount,
	moveEntry as relocateEntry,
	removeSet as dropSet
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
	 */
	public constructor(history: History, resume: Resume | null = null) {
		this.history = history;

		if (resume !== null) {
			this.workout = resume.workout;
			this.activeSetId = resume.activeSetId;
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
		this.activeSetId = setId;
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

		const next = advanceFrom(this.workout, id);
		this.activeSetId = next === null ? null : next.set.id;
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
			this.activeSetId = set.id;
		}
	}

	/**
	 * Mid-workout insert: a new entry at the end of the session, sets and ids
	 * minted here for the same reason `addSet`'s is. How many is
	 * `insertedSetCount`'s rule, read against the store-derived history the
	 * session was constructed with.
	 *
	 * Same cursor rule as `addSet`: a finished session hands the cursor to the
	 * first inserted set, otherwise the user's place is not stolen.
	 */
	public addExercise(exerciseId: string): void {
		const count = insertedSetCount(this.history, exerciseId);

		const entry = insertExercise(this.workout, exerciseId, {
			entry: crypto.randomUUID(),
			exercise: crypto.randomUUID(),
			sets: Array.from({ length: count }, () => crypto.randomUUID())
		});

		if (entry !== null && this.activeSetId === null) {
			this.activeSetId = entry.exercises[0].sets[0].id;
		}
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
		this.activeSetId = next === null ? null : next.set.id;
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
