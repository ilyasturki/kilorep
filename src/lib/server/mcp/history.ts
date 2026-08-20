import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';

import { localDateOf } from '$lib/domain/bodyweight';
import type { Drift } from '$lib/domain/drift';
import type { Carried } from '$lib/domain/load';
import { driftFrom, hasSetDrift } from '$lib/domain/drift';
import type { Workout, WorkoutEntry } from '$lib/domain/workout';
import { completedSetCount, exerciseCount, workoutTitle } from '$lib/history/label';
import type { FinishedWorkout } from '$lib/store/derive';

import type { Tools } from './context.ts';
import {
	DATE,
	TIME,
	VERSION,
	dayAfter,
	dayStart,
	failed,
	iso,
	momentOf,
	refused,
	reply,
	volumeOf
} from './format.ts';
import { nameOf, unknownIds } from './library.ts';
import { PERFORMED_EXERCISE, flatRows, workoutEntriesOf } from './shapes.ts';

const MINUTES = z
	.number()
	.int()
	.min(0)
	.max(1440)
	.describe('how long the session took; omit when you do not know rather than inventing one');

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

/** The wall time on the server's own clock, which is the clock the session was stamped by. */
function timeOf(at: number): string {
	const when = new Date(at);

	return `${pad(when.getHours())}:${pad(when.getMinutes())}`;
}

/**
 * The performed tree, flattened the way a caller writes it back.
 *
 * Entry, exercise and set ids stay inside: they are minted afresh on every write, so handing
 * them out would invite a caller to quote one back and believe it meant something. Supersets
 * survive the flattening as group numbers, which is the same shape the write tools take.
 */
function performedRows(workout: Workout, drift: Drift | null): Record<string, unknown>[] {
	return flatRows(workout.entries, (exercise) => {
		const row: Record<string, unknown> = {
			exerciseId: exercise.exerciseId,
			name: nameOf(exercise.exerciseId),
			sets: exercise.sets.map((set) => ({
				weight: set.weight,
				reps: set.reps,
				type: set.type,
				rpe: set.rpe,
				completed: set.completed,
				plannedReps: set.plannedReps
			}))
		};

		const moved = drift === null ? undefined : drift.matched[exercise.id];

		if (moved !== undefined && hasSetDrift(moved)) {
			row.drift = moved;
		}

		return row;
	});
}

function exerciseIdsOf(entries: WorkoutEntry[], ids: string[]): string[] {
	const flat = entries.flatMap((entry) => entry.exercises);

	return ids.map((id) => {
		const found = flat.find((exercise) => exercise.id === id);

		return found === undefined ? id : found.exerciseId;
	});
}

function totalsOf(workout: FinishedWorkout, carried: Carried): Record<string, number> {
	return {
		exercises: exerciseCount(workout),
		completedSets: completedSetCount(workout),
		volumeKg: volumeOf(workout, carried)
	};
}

export function registerHistory(server: McpServer, { library, write }: Tools): void {
	const detail = (workout: FinishedWorkout): Record<string, unknown> => {
		const template = workout.templateId === null ? null : library.template(workout.templateId);
		const drift = template === null ? null : driftFrom(workout, template);

		return {
			id: workout.id,
			version: library.version(workout.id),
			title: workoutTitle(workout, library.templates()),
			templateId: workout.templateId,
			startedAt: iso(workout.startedAt),
			finishedAt: iso(workout.finishedAt),
			minutes: Math.round((workout.finishedAt - workout.startedAt) / 60_000),
			totals: totalsOf(workout, library.carried()),
			drift:
				drift === null
					? null
					: {
							unplanned: exerciseIdsOf(workout.entries, drift.unplanned),
							missing: drift.missing
						},
			exercises: performedRows(workout, drift)
		};
	};

	server.registerTool(
		'workouts',
		{
			title: 'Workout history',
			description:
				'Finished sessions, newest first, one row each with its title, volume and set count. This is history only — a session in progress lives on the phone and never reaches the server.',
			inputSchema: z.object({
				from: DATE.optional().describe('earliest day to include, inclusive'),
				to: DATE.optional().describe('latest day to include, inclusive'),
				limit: z.number().int().min(1).max(200).default(20)
			}),
			annotations: { readOnlyHint: true }
		},
		({ from, to, limit }) => {
			const templates = library.templates();
			const after = from === undefined ? Number.NEGATIVE_INFINITY : dayStart(from);
			const before = to === undefined ? Number.POSITIVE_INFINITY : dayAfter(to);

			const matched = library
				.workouts()
				.filter((workout) => workout.startedAt >= after && workout.startedAt < before)
				.toReversed();

			return reply({
				matched: matched.length,
				returned: Math.min(matched.length, limit),
				workouts: matched.slice(0, limit).map((workout) => ({
					id: workout.id,
					title: workoutTitle(workout, templates),
					templateId: workout.templateId,
					startedAt: iso(workout.startedAt),
					finishedAt: iso(workout.finishedAt),
					exercises: exerciseCount(workout),
					sets: completedSetCount(workout),
					volumeKg: volumeOf(workout, library.carried())
				}))
			});
		}
	);

	server.registerTool(
		'workout',
		{
			title: 'One session, set by set',
			description:
				'A finished session in full: every exercise, every set with its weight, reps, type and RPE, and — where it was started from a plan — how it drifted from what was planned. The `version` it returns is what edit_workout and delete_workout need.',
			inputSchema: z.object({
				id: z.string().describe('workout id, from workouts')
			}),
			annotations: { readOnlyHint: true }
		},
		({ id }) => {
			const workout = library.workout(id);

			return workout === null ? reply({ error: `no workout ${id}` }) : reply(detail(workout));
		}
	);

	server.registerTool(
		'log_workout',
		{
			title: 'Log a session that already happened',
			description:
				'Write a finished session into history — a workout trained away from the phone, or one the lifter forgot to log. Sets are recorded as completed unless said otherwise, because an uncompleted set counts towards nothing. This is the one thing here the app itself cannot do: on the phone a workout is logged live and ends at FINISH, so use this only for a session that genuinely happened and is missing.',
			inputSchema: z.object({
				date: DATE.describe('the day it was trained'),
				startedAt: TIME.default('12:00').describe('wall time it began'),
				minutes: MINUTES.default(0),
				templateId: z
					.string()
					.optional()
					.describe(
						'the plan it ran, if it ran one — this is what names it and moves the rotation'
					),
				exercises: z.array(PERFORMED_EXERCISE).min(1).max(50)
			}),
			annotations: { idempotentHint: false }
		},
		({ date, startedAt, minutes, templateId, exercises }) => {
			const unknown = unknownIds(exercises);

			if (unknown.length > 0) {
				return reply({ error: `not in the catalogue: ${unknown.join(', ')}` });
			}

			if (templateId !== undefined && library.template(templateId) === null) {
				return reply({ error: `no plan ${templateId}` });
			}

			const began = momentOf(date, startedAt);

			const payload: FinishedWorkout = {
				id: crypto.randomUUID(),
				templateId: templateId ?? null,
				startedAt: began,
				entries: workoutEntriesOf(exercises),
				finishedAt: began + minutes * 60_000
			};

			const outcome = write({
				id: payload.id,
				kind: 'workout',
				payload,
				expect: 'absent'
			});

			if (failed(outcome)) {
				return refused(outcome);
			}

			return reply({
				id: payload.id,
				version: outcome.updatedAt,
				startedAt: iso(payload.startedAt),
				totals: totalsOf(payload, library.carried())
			});
		}
	);

	server.registerTool(
		'edit_workout',
		{
			title: 'Correct a logged session',
			description:
				'Change a session that is already in history — a mistyped weight, a forgotten set, a FINISH that never got tapped and left the session hours long. Read it with workout first and pass the `version` it gave you; the write is refused if the record has moved since. Anything you leave out is carried over untouched, but `exercises` replaces the whole tree, so send it back in full.',
			inputSchema: z.object({
				id: z.string(),
				version: VERSION,
				date: DATE.optional().describe('move it to another day'),
				startedAt: TIME.optional(),
				minutes: MINUTES.optional().describe('omit to keep however long it currently says'),
				templateId: z
					.string()
					.nullable()
					.optional()
					.describe('null unlinks it from its plan; omit to leave the link alone'),
				exercises: z.array(PERFORMED_EXERCISE).min(1).max(50).optional()
			}),
			annotations: { idempotentHint: false }
		},
		({ id, version, date, startedAt, minutes, templateId, exercises }) => {
			const stored = library.workout(id);

			if (stored === null) {
				return reply({ error: `no workout ${id}` });
			}

			if (exercises !== undefined) {
				const unknown = unknownIds(exercises);

				if (unknown.length > 0) {
					return reply({ error: `not in the catalogue: ${unknown.join(', ')}` });
				}
			}

			if (
				templateId !== undefined &&
				templateId !== null &&
				library.template(templateId) === null
			) {
				return reply({ error: `no plan ${templateId}` });
			}

			const moved =
				date === undefined && startedAt === undefined
					? stored.startedAt
					: momentOf(
							date ?? localDateOf(new Date(stored.startedAt)),
							startedAt ?? timeOf(stored.startedAt)
						);

			// A session moved to another day keeps however long it took; only `minutes` resets that.
			const lasted =
				minutes === undefined ? stored.finishedAt - stored.startedAt : minutes * 60_000;

			const payload: FinishedWorkout = {
				id: stored.id,
				templateId: templateId === undefined ? stored.templateId : templateId,
				startedAt: moved,
				entries: exercises === undefined ? stored.entries : workoutEntriesOf(exercises),
				finishedAt: moved + lasted
			};

			const outcome = write({
				id: stored.id,
				kind: 'workout',
				payload,
				expect: version
			});

			if (failed(outcome)) {
				return refused(outcome);
			}

			return reply({
				id: payload.id,
				version: outcome.updatedAt,
				startedAt: iso(payload.startedAt),
				minutes: Math.round(lasted / 60_000),
				totals: totalsOf(payload, library.carried())
			});
		}
	);

	server.registerTool(
		'delete_workout',
		{
			title: 'Delete a session',
			description:
				'Remove a logged session from history. There is no undo, and the volume, sets and personal bests it carried go with it — a personal best set in this session stops being one. Read it with workout first and pass the `version` it gave you.',
			inputSchema: z.object({
				id: z.string(),
				version: VERSION
			}),
			annotations: { destructiveHint: true, idempotentHint: true }
		},
		({ id, version }) => {
			const stored = library.workout(id);

			if (stored === null) {
				return reply({ error: `no workout ${id}` });
			}

			const outcome = write({
				id,
				kind: 'workout',
				payload: stored,
				expect: version,
				deleted: true
			});

			if (failed(outcome)) {
				return refused(outcome);
			}

			return reply({
				deleted: {
					id,
					title: workoutTitle(stored, library.templates()),
					startedAt: iso(stored.startedAt),
					totals: totalsOf(stored, library.carried())
				}
			});
		}
	);
}
