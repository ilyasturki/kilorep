import { cursorFor, entryCursors } from './workout.ts';
import type { Workout, WorkoutEntry } from './workout.ts';

export const DEFAULT_REST_SECONDS = 120;

export const REST_NUDGE_SECONDS = 30;

export const REST_STEP_SECONDS = 15;

export const MIN_REST_SECONDS = 15;
export const MAX_REST_SECONDS = 600;

// How long SKIP stays undoable: long enough to notice a mis-tap, short enough
// to be gone before the next set.
export const REST_UNDO_MS = 5000;

// `overrides` is tri-state per exercise: missing key = default applies, number = override,
// explicit null = never rest on this exercise.
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

export function restSecondsFor(exerciseId: string, settings: RestSettings): number | null {
	const override = settings.overrides[exerciseId];

	return override === undefined ? settings.seconds : override;
}

export type PlannedRest = { exerciseId: string; restSeconds?: number | null };

export function restSecondsOf(exercise: PlannedRest, settings: RestSettings): number | null {
	return exercise.restSeconds === undefined
		? restSecondsFor(exercise.exerciseId, settings)
		: exercise.restSeconds;
}

export function closesRound(entry: WorkoutEntry, setId: string): boolean {
	const order = entryCursors(entry);
	const at = order.findIndex((cursor) => cursor.set.id === setId);

	if (at === -1) {
		return false;
	}

	// Warmups all share workingIndex -1; they are not in any round.
	if (order[at].workingIndex < 0) {
		return false;
	}

	const next = order[at + 1];

	return next === undefined || next.workingIndex !== order[at].workingIndex;
}

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

	const seconds = restSecondsOf(cursor.exercise, settings);

	return seconds === null ? null : { exerciseId: cursor.exercise.exerciseId, seconds };
}

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

export function nudgedEnd(endsAt: number, bySeconds: number, now: number): number {
	const next = endsAt + bySeconds * 1000;

	return Math.min(Math.max(next, now), now + MAX_REST_SECONDS * 1000);
}

export function settleRestSeconds(seconds: number): number {
	return Math.min(MAX_REST_SECONDS, Math.max(MIN_REST_SECONDS, Math.round(seconds)));
}
