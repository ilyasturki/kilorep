/**
 * The reactive shell around the workout domain.
 *
 * Kept separate from `$lib/domain/workout` deliberately: that module is plain
 * TypeScript with zero framework imports, per STACK.md's standing rule, and
 * this file is the one place a rune touches the tree. Every rule it applies —
 * where the active set goes, what the fields open at, whether the check is
 * live — is imported, not reimplemented.
 *
 * In memory only. Persistence and auto-resume are deliberately absent: the
 * store this would be written against does not exist yet.
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
import type { Workout } from '$lib/domain/workout';
import { freshWorkout, history } from '$lib/domain/fixture';

export class WorkoutSession {
	public workout: Workout = $state(freshWorkout(Date.now()));

	/**
	 * The one active set. Null once nothing is left uncompleted, which is the
	 * finished state — the screen has no other way to be done, because PRODUCT.md
	 * gives finishing no ceremony to announce it.
	 */
	public activeSetId: string | null = $state(null);

	// The field initialiser above is the tree; the constructor only points the
	// cursor at it. Calling `reset()` here instead would build a second fixture
	// and throw the first away, since `$state` fields initialise first.
	public constructor() {
		this.activeSetId = firstUncompleted(this.workout)?.set.id ?? null;
	}

	public get finished(): boolean {
		return this.activeSetId === null;
	}

	public reset(): void {
		this.workout = freshWorkout(Date.now());
		this.activeSetId = firstUncompleted(this.workout)?.set.id ?? null;
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
	 * `insertedSetCount`'s rule; the history it reads is the fixture's for now,
	 * like `freshWorkout` above — both leave together when the store lands.
	 *
	 * Same cursor rule as `addSet`: a finished session hands the cursor to the
	 * first inserted set, otherwise the user's place is not stolen.
	 */
	public addExercise(exerciseId: string): void {
		const count = insertedSetCount(history, exerciseId);

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
