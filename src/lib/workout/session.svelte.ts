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

import { advanceFrom, commitSet, firstUncompleted } from '$lib/domain/workout';
import type { Workout } from '$lib/domain/workout';
import { freshWorkout } from '$lib/domain/fixture';

/**
 * PRODUCT.md puts the real default in Settings and the override on the
 * Exercise. Neither exists, so the value is pinned here and named, rather than
 * being an unexplained 90 somewhere in a component.
 */
export const REST_SECONDS = 90;

export class WorkoutSession {
	public workout: Workout = $state(freshWorkout(Date.now()));

	/**
	 * The one active set. Null once nothing is left uncompleted, which is the
	 * finished state — the screen has no other way to be done, because PRODUCT.md
	 * gives finishing no ceremony to announce it.
	 */
	public activeSetId: string | null = $state(null);

	/**
	 * Epoch ms of the last commit, or null when not resting. The chip counts down
	 * from this rather than from a ticking counter, so a resumed or backgrounded
	 * screen shows the true remaining time instead of a stale one.
	 */
	public restStartedAt: number | null = $state(null);

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
		this.restStartedAt = null;
	}

	/** Overriding the advance: an overview jump, or a tap on a pending row. */
	public select(setId: string): void {
		this.activeSetId = setId;
	}

	/**
	 * The check. One gesture, three effects — write the set, start the rest, move
	 * on — which is the compound commit BENCHMARK.md records the whole market
	 * converging on, and the reason a set costs one tap.
	 */
	public commit(weight: number, reps: number): void {
		const id = this.activeSetId;

		if (id === null || !commitSet(this.workout, id, weight, reps)) {
			return;
		}

		this.restStartedAt = Date.now();

		const next = advanceFrom(this.workout, id);
		this.activeSetId = next === null ? null : next.set.id;
	}

	public skipRest(): void {
		this.restStartedAt = null;
	}
}
