import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';

import { catalog } from '$lib/catalog';
import { bodyweightShareOf, carriedOn } from '$lib/domain/load';
import { REST_DEFAULT_ID, noteId, restOverrideId } from '$lib/domain/preference';
import { MAX_REST_SECONDS, MIN_REST_SECONDS, restSecondsFor } from '$lib/domain/rest';
import { searchExercises } from '$lib/domain/search';
import { estimated1Rm } from '$lib/domain/stats';

import type { Tools } from './context.ts';
import { bestOf, failed, identify, iso, refused, reply, round, summarise } from './format.ts';
import { exerciseOf, noSuchExercise } from './library.ts';

const SECONDS = z.number().int().min(MIN_REST_SECONDS).max(MAX_REST_SECONDS);

export function registerExercises(server: McpServer, { library, write }: Tools): void {
	server.registerTool(
		'search_exercises',
		{
			title: 'Search exercises',
			description:
				'Find exercises in the catalogue by name or alias. Omit the query to list the whole catalogue — which is fixed: it is the movements this app knows, it cannot be added to, and a movement absent from it is planned as the nearest one present. Use this to resolve a movement the lifter named in prose into the id every other tool takes. Rows carry identity only unless you ask for `detail`; one exercise’s history belongs to the `exercise` tool.',
			inputSchema: z.object({
				query: z.string().optional().describe('name or alias, fuzzy-matched; omit to list all'),
				limit: z.number().int().min(1).max(100).default(20),
				trainedOnly: z.boolean().default(false).describe('keep only exercises with logged history'),
				detail: z
					.boolean()
					.default(false)
					.describe(
						'add last trained, the last sets and the personal best to every row — several times the payload, and worth it only when comparing history across a handful of movements'
					)
			}),
			annotations: { readOnlyHint: true }
		},
		({ query, limit, trainedOnly, detail }) => {
			const matched = searchExercises(catalog, query ?? '');

			// Asked for per exercise rather than up front: the whole history is derived to answer
			// this, and the lean row — the default, and the reason this tool is called at all —
			// never looks at it. `pastSessions` shares the same memo, so `detail` still pays once.
			const pool = trainedOnly
				? matched.filter((exercise) => library.pastSessions(exercise.id).length > 0)
				: matched;

			const shown = pool
				.slice(0, limit)
				.map((exercise) => (detail ? summarise(exercise, library) : identify(exercise)));

			return reply({
				matched: pool.length,
				returned: shown.length,
				exercises: shown,
				note:
					pool.length === 0 && query !== undefined
						? `nothing in the catalogue matches "${query}". The catalogue is fixed and cannot be added to — plan the nearest movement it does have.`
						: undefined
			});
		}
	);

	server.registerTool(
		'exercise',
		{
			title: 'Exercise detail',
			description:
				'Everything the app knows about one exercise: its catalogue entry, the standing note, the rest duration in force, the raw personal best, the estimated-1RM trend and recent sessions set by set.',
			inputSchema: z.object({
				id: z.string().describe('catalogue id, e.g. "bench-press" — from search_exercises'),
				sessions: z.number().int().min(0).max(50).default(8).describe('how many recent sessions')
			}),
			annotations: { readOnlyHint: true }
		},
		({ id, sessions: wanted }) => {
			const exercise = exerciseOf(id);

			if (exercise === undefined) {
				return reply({ error: noSuchExercise(id) });
			}

			const past = library.pastSessions(id);
			const carried = carriedOn(library.carried(), id);
			// slice(-0) is slice(0), which is the whole history — the one value meaning none.
			const recent = wanted === 0 ? [] : past.slice(-wanted);

			return reply({
				id: exercise.id,
				name: exercise.name,
				aliases: exercise.aliases,
				equipment: exercise.equipment,
				loadMode: exercise.loadMode,
				bodyweightShare: bodyweightShareOf(exercise) === 0 ? undefined : exercise.bodyweightShare,
				muscles: exercise.muscles,
				variantOf: exercise.variantOf,
				note: library.noteOf(id),
				restSeconds: restSecondsFor(id, library.restSettings()),
				trainedSessions: past.length,
				pr: bestOf(past, carried),
				sessions: recent.map((session) => ({
					date: iso(session.date),
					workoutId: session.workoutId,
					est1rm: round(
						Math.max(0, ...session.sets.map((set) => estimated1Rm(set, carried(session.date))))
					),
					sets: session.sets.map((set) => ({
						weight: set.weight,
						reps: set.reps,
						rpe: set.rpe
					}))
				}))
			});
		}
	);

	server.registerTool(
		'set_exercise_note',
		{
			title: 'Write an exercise note',
			description:
				'The standing note on an exercise — the seat number, the grip, the pin that always sticks. It lives on the exercise’s own screen and is never shown while logging, so it is a reminder for next time rather than a cue mid-set. Empty text clears it.',
			inputSchema: z.object({
				id: z.string().describe('catalogue id — from search_exercises'),
				text: z.string().max(2000).describe('the note; pass "" to clear it')
			}),
			annotations: { idempotentHint: true }
		},
		({ id, text }) => {
			if (exerciseOf(id) === undefined) {
				return reply({ error: noSuchExercise(id) });
			}

			const trimmed = text.trim();
			const before = library.noteOf(id);

			if (trimmed === '' && before === null) {
				return reply({ note: null, replaced: null });
			}

			const outcome = write({
				id: noteId(id),
				kind: 'preference',
				payload: { text: trimmed },
				expect: 'any',
				deleted: trimmed === ''
			});

			if (failed(outcome)) {
				return refused(outcome);
			}

			return reply({ note: trimmed === '' ? null : trimmed, replaced: before });
		}
	);

	server.registerTool(
		'set_rest',
		{
			title: 'Set a rest duration',
			description:
				'The rest timer between working sets. Called with no arguments at all it writes nothing and answers with the standing default — read it that way before overriding it, since the default is the number a plan or an exercise is then departing from. With no exerciseId it sets that default; with one it is that exercise’s own override — a number of seconds, or null to never rest on it. Careful: an exerciseId with no seconds is not a read, it drops the override and inherits again; the duration in force on one exercise is a field on `exercise`. A plan can also carry its own duration, written through save_plan, which wins over both.',
			inputSchema: z.object({
				exerciseId: z
					.string()
					.optional()
					.describe(
						'omit to set the default that every exercise inherits, or omit everything to read it'
					),
				seconds: SECONDS.nullable()
					.optional()
					.describe('seconds; null means never rest here; omit alongside exerciseId to inherit'),
				enabled: z.boolean().optional().describe('the default only — false turns rest off entirely')
			}),
			annotations: { idempotentHint: true }
		},
		({ exerciseId, seconds, enabled }) => {
			const settings = library.restSettings();

			if (exerciseId === undefined) {
				if (seconds === null) {
					return reply({
						error:
							'null seconds says "never rest here", which only an exercise can say — pass enabled: false to turn rest off entirely'
					});
				}

				// Naming neither is a question, not an edit: rewriting the record with its own
				// values would stamp it afresh and push a change that changed nothing.
				if (seconds === undefined && enabled === undefined) {
					return reply({ default: { enabled: settings.enabled, seconds: settings.seconds } });
				}

				const next = {
					enabled: enabled ?? settings.enabled,
					seconds: seconds ?? settings.seconds
				};

				const outcome = write({
					id: REST_DEFAULT_ID,
					kind: 'preference',
					payload: next,
					expect: 'any'
				});

				return failed(outcome) ? refused(outcome) : reply({ default: next });
			}

			if (exerciseOf(exerciseId) === undefined) {
				return reply({ error: noSuchExercise(exerciseId) });
			}

			if (enabled !== undefined) {
				return reply({ error: 'enabled belongs to the default; drop the exerciseId to set it' });
			}

			const had = Object.hasOwn(settings.overrides, exerciseId);

			if (seconds === undefined && !had) {
				return reply({ exerciseId, restSeconds: restSecondsFor(exerciseId, settings) });
			}

			const outcome = write({
				id: restOverrideId(exerciseId),
				kind: 'preference',
				payload: { seconds: seconds ?? null },
				expect: 'any',
				deleted: seconds === undefined
			});

			if (failed(outcome)) {
				return refused(outcome);
			}

			// Cleared, the exercise inherits again; set, the override is what it now rests for.
			return reply({
				exerciseId,
				inherits: seconds === undefined,
				restSeconds: seconds === undefined ? settings.seconds : seconds
			});
		}
	);
}
