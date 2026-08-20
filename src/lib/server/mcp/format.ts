import { z } from 'zod';

import { localDateOf } from '$lib/domain/bodyweight';
import type { Exercise } from '$lib/domain/exercise';
import type { PastSession } from '$lib/domain/stats';
import { rawPr } from '$lib/domain/stats';
import type { Workout } from '$lib/domain/workout';

import type { Library } from './library.ts';
import { loadFactorOf } from './library.ts';
import type { WriteOutcome } from './write.ts';

export type ToolReply = { content: { type: 'text'; text: string }[] };

/** The tool result shape every handler here returns: one compact JSON document. */
export function reply(value: unknown): ToolReply {
	return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

/** A refusal reads as a result rather than a throw: the caller is meant to re-read and retry. */
export function refused(outcome: { reason: string; storedUpdatedAt: number | null }): ToolReply {
	return reply({ error: outcome.reason, version: outcome.storedUpdatedAt });
}

export function iso(ms: number): string {
	return new Date(ms).toISOString();
}

/** Two decimals at most — volume in kg carries no meaning past that, and the digits cost tokens. */
export function round(value: number): number {
	return Math.round(value * 100) / 100;
}

export function roundOrNull(value: number | null): number | null {
	return value === null ? null : round(value);
}

export function volumeOf(workout: Workout): number {
	let kg = 0;

	for (const entry of workout.entries) {
		for (const exercise of entry.exercises) {
			const factor = loadFactorOf(exercise.exerciseId);

			for (const set of exercise.sets) {
				if (set.completed && set.type !== 'warmup' && set.weight !== null && set.reps !== null) {
					kg += set.weight * set.reps * factor;
				}
			}
		}
	}

	return round(kg);
}

export function bestOf(
	sessions: PastSession[]
): { weight: number; reps: number; at: string } | null {
	const pr = rawPr(sessions);

	return pr === null ? null : { weight: pr.set.weight, reps: pr.set.reps, at: iso(pr.date) };
}

export function summarise(exercise: Exercise, library: Library): Record<string, unknown> {
	const sessions = library.pastSessions(exercise.id);
	const last = sessions.at(-1);

	return {
		id: exercise.id,
		name: exercise.name,
		equipment: exercise.equipment,
		loadMode: exercise.loadMode,
		primary: exercise.muscles.primary,
		variantOf: exercise.variantOf,
		lastTrained: last === undefined ? null : iso(last.date),
		lastSets:
			last === undefined ? null : last.sets.map((set) => `${set.weight} × ${set.reps}`).join(', '),
		pr: bestOf(sessions)
	};
}

/** Local midnight on the server clock — a self-hosted box the lifter owns, so near enough their day. */
export function dayStart(date: string): number {
	const [year, month, day] = date.split('-').map(Number);

	return new Date(year, month - 1, day).getTime();
}

/**
 * Midnight opening the day after — the exclusive end of `date`.
 *
 * Rolled over by the Date constructor rather than by adding 24 hours: the two local days a
 * DST switch falls on are 23 and 25 hours long, and a fixed addition would put the bound an
 * hour inside the wrong day.
 */
export function dayAfter(date: string): number {
	const [year, month, day] = date.split('-').map(Number);

	return new Date(year, month - 1, day + 1).getTime();
}

/**
 * A real day, not a well-shaped string.
 *
 * The pattern alone lets `2026-02-30` and `2026-13-45` through, and the Date constructor
 * rolls both onto a day that exists — so a mistyped date would write to 2 March rather than
 * be refused. The round trip through local midnight is what refuses it.
 */
export const DATE = z
	.string()
	.regex(/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/u, 'expected a YYYY-MM-DD date')
	.refine((date) => localDateOf(new Date(dayStart(date))) === date, 'no such day in that month');

export const TIME = z
	.string()
	.regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u, 'expected a HH:MM time on a 24-hour clock');

export const VERSION = z
	.number()
	.int()
	.describe(
		'the `version` the read handed you; the write is refused if the record has moved since'
	);

/**
 * `at`, on the server's own clock, from the day and the wall time the caller named.
 *
 * Built from components rather than added to midnight: on the day the clocks go forward,
 * midnight plus twelve hours is 13:00, and the session would be stamped an hour late.
 */
export function momentOf(date: string, time: string): number {
	const [year, month, day] = date.split('-').map(Number);
	const [hours, minutes] = time.split(':').map(Number);

	return new Date(year, month - 1, day, hours, minutes).getTime();
}

export function failed(outcome: WriteOutcome): outcome is Extract<WriteOutcome, { ok: false }> {
	return !outcome.ok;
}
