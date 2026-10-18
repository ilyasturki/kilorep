import { cursorFor, entryCursors, untouched } from './workout.ts';
import type { Workout, WorkoutEntry } from './workout.ts';

export const DEFAULT_REST_SECONDS = 120;

export const REST_NUDGE_SECONDS = 30;

export const REST_STEP_SECONDS = 15;

export const MIN_REST_SECONDS = 15;
export const MAX_REST_SECONDS = 600;

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

export type RestStart = { exerciseId: string; seconds: number; name?: string };

// Nearest word first: the exercise's own duration in Settings, then the plan's default, then
// the Settings default.
export function restSecondsFor(
	exerciseId: string,
	settings: RestSettings,
	planDefault?: number | null
): number | null {
	const override = settings.overrides[exerciseId];

	if (override !== undefined) {
		return override;
	}

	return planDefault === undefined ? settings.seconds : planDefault;
}

export type PlannedRest = { exerciseId: string; restSeconds?: number | null };

export function restSecondsOf(
	exercise: PlannedRest,
	settings: RestSettings,
	planDefault?: number | null
): number | null {
	return exercise.restSeconds === undefined
		? restSecondsFor(exercise.exerciseId, settings, planDefault)
		: exercise.restSeconds;
}

/** What a plan's default rest gives the session for one of its exercises. */
export type StartingRest = { planDefault: number | null | undefined; settings: RestSettings };

// The default fills only the silences: an exercise the plan already times, or one with its own
// duration in Settings, keeps what it had.
export function startingRest(
	exercise: PlannedRest,
	{ planDefault, settings }: StartingRest
): number | null | undefined {
	if (
		exercise.restSeconds !== undefined ||
		planDefault === undefined ||
		settings.overrides[exercise.exerciseId] !== undefined
	) {
		return exercise.restSeconds;
	}

	return planDefault;
}

/** The leg a superset's one rest is read off: the last, which closes every full round. */
export function roundLeg<E>(legs: E[]): E {
	const leg = legs.at(-1);

	if (leg === undefined) {
		throw new RangeError('an entry holds at least one exercise');
	}

	return leg;
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

	// An optional leg nobody has started is passed over, so the leg before it closes the round.
	const next = order.slice(at + 1).find((cursor) => !untouched(cursor.exercise));

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

// The most digits a rest is typed in: `10:00` is the ceiling, and refusing the fifth keystroke
// is kinder than silently dropping the first.
const REST_DRAFT_DIGITS = 4;

const digitsOf = (raw: string): string => raw.replaceAll(/\D/gu, '');

// Where the digits split. The last two are the seconds, whatever is left is the minutes, and an
// empty minutes half is a rest under one — `5` is `0:05`, not five minutes.
function clockOf(digits: string): [number, number] {
	const minutes = digits.slice(0, -2);

	return [minutes === '' ? 0 : Number(minutes), Number(digits.slice(-2))];
}

/**
 * A rest is typed the way a clock is. A numeric pad has no colon on it, so the digits fill from
 * the right and `2 3 0` is 2:30 without ever reaching for a key that is not there — the field
 * grows the colon itself. A colon typed on a real keyboard is welcome and redundant: it is
 * stripped, and the digits either side of it say the same thing. `null` refuses the keystroke.
 */
export function restDraft(raw: string): string | null {
	const digits = digitsOf(raw);

	if (digits.length > REST_DRAFT_DIGITS) {
		return null;
	}

	if (digits === '') {
		return '';
	}

	const [minutes, seconds] = clockOf(digits);

	return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** `restLabel` read backwards, over whatever the box holds mid-word. */
export function parseRestDraft(raw: string): number | null {
	const digits = digitsOf(raw);

	if (digits === '') {
		return null;
	}

	const [minutes, seconds] = clockOf(digits);

	return minutes * 60 + seconds;
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

// Every rung the arms and the ruler can reach is a multiple of the step, so a duration typed
// between two of them joins the ladder rather than stranding itself beside it — a stray seven
// seconds would otherwise ride along on every tap of an arm for the rest of the field's life.
export function snapRestSeconds(seconds: number): number {
	return settleRestSeconds(Math.round(seconds / REST_STEP_SECONDS) * REST_STEP_SECONDS);
}
