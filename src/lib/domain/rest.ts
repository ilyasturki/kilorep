import { cursorFor, entryCursors } from './workout.ts';
import type { Workout, WorkoutEntry } from './workout.ts';

export const DEFAULT_REST_SECONDS = 120;

export const REST_NUDGE_SECONDS = 30;

export const REST_STEP_SECONDS = 15;

export const MIN_REST_SECONDS = 15;
export const MAX_REST_SECONDS = 600;

/**
 * How long SKIP stays undoable.
 *
 * Five seconds, which is the length of a change of mind and not of a decision:
 * long enough for the thumb that skipped to notice it skipped, short enough
 * that the strip is gone before the bar is racked. Beyond that the offer would
 * be sitting on screen through a set — the timer as a thing to dismiss twice,
 * which is the shape MARKET.md refuses.
 */
export const REST_UNDO_MS = 5000;

/**
 * Everything the rules below need to know about the user's taste, flattened.
 *
 * `overrides` is per exercise and tri-state, and the third state is the point:
 * absent means "the default applies", a number means "this instead", and an
 * explicit `null` means *never rest on this* — the exercise you circuit. A
 * missing key and a null key are not the same answer, which is why this is a
 * record of `number | null` rather than a record of `number`.
 */
export type RestSettings = {
	enabled: boolean;
	seconds: number;
	overrides: Record<string, number | null | undefined>;
};

export const defaultRestSettings = (): RestSettings => ({
	enabled: true,
	seconds: DEFAULT_REST_SECONDS,
	overrides: {}
});

export type RestStart = { exerciseId: string; seconds: number };

/**
 * The override belongs to the exercise and not to its family — Close-Grip Bench
 * answers for itself, never for Bench Press. That is the rule that already
 * keeps hints and history from crossing `variantOf`, and a rest duration is the
 * same kind of fact: the reason a close-grip triple needs three minutes has
 * nothing to do with what the wide-grip entry was set to.
 */
export function restSecondsFor(exerciseId: string, settings: RestSettings): number | null {
	const override = settings.overrides[exerciseId];

	return override === undefined ? settings.seconds : override;
}

/**
 * One exercise as a plan left it: the catalog entry it names, and whatever the
 * plan said about resting after it. Structural on purpose — a planned exercise
 * and a performed one answer this question identically, and neither type needs
 * to be imported here to say so.
 */
export type PlannedRest = { exerciseId: string; restSeconds?: number | null };

/**
 * The whole precedence, in one line: the plan, then the exercise, then the
 * default, an absence falling through at each step.
 *
 * The plan wins over the exercise's own duration because it is the more
 * specific sentence — "three minutes on squats *in this session*" is said by
 * somebody who knows what the exercise usually gets and wants today to differ.
 * A `null` at either level is an answer and stops the fall: never rest here.
 */
export function restSecondsOf(exercise: PlannedRest, settings: RestSettings): number | null {
	return exercise.restSeconds === undefined
		? restSecondsFor(exercise.exerciseId, settings)
		: exercise.restSeconds;
}

/**
 * Whether this set is the last one of its round inside its entry.
 *
 * `entryCursors` lays an entry out as warmups first, then round by round across
 * the legs — A1, B1, A2, B2 — so every cursor in a round shares a
 * `workingIndex` and the next round bumps it.
 */
export function closesRound(entry: WorkoutEntry, setId: string): boolean {
	const order = entryCursors(entry);
	const at = order.findIndex((cursor) => cursor.set.id === setId);

	if (at === -1) {
		return false;
	}

	// Warmups share an index of -1 and sit ahead of every round, so the test
	// below would call the last of them a round-closer. They are not in a round
	// at all — `restAfter` refuses them on their own account, and this predicate
	// has to be able to say so by itself.
	if (order[at].workingIndex < 0) {
		return false;
	}

	const next = order[at + 1];

	return next === undefined || next.workingIndex !== order[at].workingIndex;
}

/**
 * What committing this set earns, or null for no rest at all.
 *
 * Asked *after* the commit has landed, which is why the set being completed is
 * one of the tests: an un-log and a half-typed draft both reach the same tree
 * and neither is somebody having just lifted something.
 */
export function restAfter(
	workout: Workout,
	setId: string,
	settings: RestSettings
): RestStart | null {
	if (!settings.enabled) {
		return null;
	}

	const cursor = cursorFor(workout, setId);

	if (cursor === null || !cursor.set.completed || cursor.workingIndex < 0) {
		return null;
	}

	if (!closesRound(cursor.entry, setId)) {
		return null;
	}

	// The round-closer's own duration, not the entry's first leg: the exercise
	// that just finished the round is the one the body is recovering from — and
	// its own duration now includes what the plan said about it.
	const seconds = restSecondsOf(cursor.exercise, settings);

	return seconds === null ? null : { exerciseId: cursor.exercise.exerciseId, seconds };
}

/**
 * The clock as the bar spells it: `1:24` counting down, `+0:14` counting up.
 *
 * Truncating rather than rounding, so a rest with a hair under a second left
 * still reads `0:00` for that hair instead of flicking to `0:01` and back. The
 * plus is the whole announcement that zero has passed — there is no colour in
 * this string and the bar's own accent does the rest.
 */
export function restLabel(ms: number): string {
	const over = ms < 0;
	const total = Math.floor(Math.abs(ms) / 1000);
	const minutes = Math.floor(total / 60);
	const seconds = String(total % 60).padStart(2, '0');

	return `${over ? '+' : ''}${minutes}:${seconds}`;
}

export function restProgress(endsAt: number, seconds: number, now: number): number {
	if (seconds <= 0) {
		return 1;
	}

	return Math.min(1, Math.max(0, 1 - (endsAt - now) / (seconds * 1000)));
}

/**
 * Where ±30s puts the end, clamped so it can never land in the past.
 *
 * A −30 on a rest with ten seconds left ends it now rather than manufacturing
 * twenty seconds of overtime that never happened — the bar flips to `+0:00`
 * and starts counting honestly from there. The ceiling is the same one the
 * duration fields use, so a thumb leaning on + cannot build a ninety-minute
 * rest by accident.
 */
export function nudgedEnd(endsAt: number, bySeconds: number, now: number): number {
	const next = endsAt + bySeconds * 1000;

	return Math.min(Math.max(next, now), now + MAX_REST_SECONDS * 1000);
}

export function settleRestSeconds(seconds: number): number {
	return Math.min(MAX_REST_SECONDS, Math.max(MIN_REST_SECONDS, Math.round(seconds)));
}
