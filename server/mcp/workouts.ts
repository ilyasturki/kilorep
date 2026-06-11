import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { and, asc, desc, eq, tables, useDrizzle } from '~~/server/utils/drizzle'
import { badRequest } from '~~/server/utils/http'
import {
    copySessionToWorkout,
    deleteWorkout,
    loadWorkoutTrees,
    parseWorkoutInput,
    writeWorkoutEntries,
} from '~~/server/utils/workouts'
import { toDateInput } from '~~/shared/utils/date'
import {
    countSets,
    formatSet,
    formatWorkout,
    resolveExercise,
    resolveExercises,
    resolveSessionTemplate,
    resolveWorkout,
    run,
} from './helpers'

export function registerWorkoutTools(server: McpServer, userId: number) {
    server.registerTool(
        'log_workout',
        {
            title: 'Log a workout',
            description:
                'Log a complete workout in one call — the main way to record training described after the fact '
                + '("log today\'s push day: bench 80kg×8/8/7 …"). Creates the workout with all sets marked done. '
                + 'Pass "session" to link it to a template; otherwise it is logged ad hoc.',
            inputSchema: {
                exercises: z
                    .array(
                        z.object({
                            exercise: z
                                .string()
                                .describe('Exercise name (fuzzy-matched)'),
                            sets: z
                                .array(
                                    z.object({
                                        weight: z
                                            .number()
                                            .optional()
                                            .describe(
                                                'Load in kg; omit for bodyweight-only sets',
                                            ),
                                        reps: z.number().int().positive(),
                                    }),
                                )
                                .min(1),
                        }),
                    )
                    .min(1)
                    .describe('Exercises in the order they were performed'),
                session: z
                    .string()
                    .optional()
                    .describe(
                        'Session template name to link and name the workout',
                    ),
                name: z
                    .string()
                    .optional()
                    .describe('Workout name when no template is given'),
                date: z
                    .string()
                    .optional()
                    .describe(
                        'When it happened (YYYY-MM-DD or ISO); defaults to now',
                    ),
                completed: z
                    .boolean()
                    .optional()
                    .describe(
                        'Default true; pass false to leave it in progress',
                    ),
            },
            annotations: { destructiveHint: false },
        },
        (input) =>
            run(() => {
                const template =
                    input.session ?
                        resolveSessionTemplate(userId, input.session)
                    :   null
                const resolved = resolveExercises(
                    userId,
                    input.exercises.map((ex) => ex.exercise),
                )
                const entries = input.exercises.map((ex, index) => ({
                    exercises: [
                        {
                            exerciseId: resolved[index]!.id,
                            sets: ex.sets.map((set) => ({
                                reps: set.reps,
                                weight: set.weight ?? null,
                                done: true,
                            })),
                        },
                    ],
                }))
                const parsed = parseWorkoutInput({
                    name: input.name,
                    completed: input.completed ?? true,
                    startedAt: input.date,
                    entries,
                })
                const startedAt = parsed.startedAt ?? new Date()

                const workout = useDrizzle().transaction((tx) => {
                    const row = tx
                        .insert(tables.workouts)
                        .values({
                            userId,
                            sessionId: template?.id ?? null,
                            name: parsed.name ?? template?.name ?? 'Workout',
                            startedAt,
                            completed: parsed.completed,
                        })
                        .returning()
                        .get()
                    writeWorkoutEntries(tx, userId, row.id, parsed.entries)
                    return row
                })

                return `Logged:\n${formatWorkout(loadWorkoutTrees(userId, [workout.id])[0]!)}`
            }),
    )

    server.registerTool(
        'start_workout',
        {
            title: 'Start a workout',
            description:
                'Start a workout from a session template, copying its prescribed sets with the load left open. '
                + 'Fill sets as you train with log_set, then finish_workout.',
            inputSchema: {
                session: z
                    .string()
                    .describe('Session template name (fuzzy-matched)'),
            },
            annotations: { destructiveHint: false },
        },
        (input) =>
            run(() => {
                const template = resolveSessionTemplate(userId, input.session)
                const workout = useDrizzle().transaction((tx) =>
                    copySessionToWorkout(tx, userId, template.id),
                )
                return `Started:\n${formatWorkout(loadWorkoutTrees(userId, [workout.id])[0]!)}\nLog sets with log_set as you go.`
            }),
    )

    server.registerTool(
        'log_set',
        {
            title: 'Log a set',
            description:
                'Record one set of the workout in progress: fills in the weight (and reps) and ticks the set off. '
                + 'Targets the next pending set of that exercise unless "set" is given; appends a new set when all '
                + 'prescribed ones are done, and adds the exercise to the workout if it is not in it yet.',
            inputSchema: {
                exercise: z.string().describe('Exercise name (fuzzy-matched)'),
                weight: z
                    .number()
                    .optional()
                    .describe('Load in kg; omit for bodyweight-only sets'),
                reps: z
                    .number()
                    .int()
                    .positive()
                    .optional()
                    .describe('Reps done; defaults to the prescribed reps'),
                set: z
                    .number()
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        '1-based set number; defaults to the next pending set',
                    ),
                workout: z
                    .number()
                    .int()
                    .positive()
                    .optional()
                    .describe('Workout id; defaults to the one in progress'),
                done: z
                    .boolean()
                    .optional()
                    .describe(
                        'Default true; pass false to record without ticking off',
                    ),
            },
            annotations: { destructiveHint: false },
        },
        (input) =>
            run(() => {
                const db = useDrizzle()
                const workout = resolveWorkout(userId, input.workout)
                const exercise = resolveExercise(userId, input.exercise)
                const done = input.done ?? true
                const weight = input.weight ?? null

                // The workout's sets for this exercise, in tree order, so a
                // 1-based "set" index matches what the app displays.
                const rows = db
                    .select({
                        set: tables.workoutSets,
                        workoutExerciseId: tables.workoutExercises.id,
                    })
                    .from(tables.workoutSets)
                    .innerJoin(
                        tables.workoutExercises,
                        eq(
                            tables.workoutSets.workoutExerciseId,
                            tables.workoutExercises.id,
                        ),
                    )
                    .innerJoin(
                        tables.workoutEntries,
                        eq(
                            tables.workoutExercises.entryId,
                            tables.workoutEntries.id,
                        ),
                    )
                    .where(
                        and(
                            eq(tables.workoutEntries.workoutId, workout.id),
                            eq(tables.workoutExercises.exerciseId, exercise.id),
                        ),
                    )
                    .orderBy(
                        asc(tables.workoutEntries.position),
                        asc(tables.workoutExercises.position),
                        asc(tables.workoutSets.position),
                    )
                    .all()

                let logged: { weight: number | null; reps: number }
                let label: string

                if (rows.length === 0) {
                    // Exercise not in this workout — append it as a new entry
                    // at the end, the same shape the app's editor would create.
                    if (input.reps == null) {
                        badRequest(
                            `${exercise.name} is not in workout #${workout.id} — pass "reps" to add it`,
                        )
                    }
                    db.transaction((tx) => {
                        const maxPosition = tx
                            .select()
                            .from(tables.workoutEntries)
                            .where(
                                eq(tables.workoutEntries.workoutId, workout.id),
                            )
                            .all()
                            .reduce((max, e) => Math.max(max, e.position), -1)
                        const entry = tx
                            .insert(tables.workoutEntries)
                            .values({
                                workoutId: workout.id,
                                position: maxPosition + 1,
                            })
                            .returning()
                            .get()
                        const workoutExercise = tx
                            .insert(tables.workoutExercises)
                            .values({
                                entryId: entry.id,
                                exerciseId: exercise.id,
                                position: 0,
                            })
                            .returning()
                            .get()
                        tx.insert(tables.workoutSets)
                            .values({
                                workoutExerciseId: workoutExercise.id,
                                reps: input.reps!,
                                weight,
                                done,
                                position: 0,
                            })
                            .run()
                    })
                    logged = { weight, reps: input.reps }
                    label = `${exercise.name} (added to workout) set 1`
                } else {
                    const nextPending = rows.findIndex((row) => !row.set.done)
                    const index =
                        input.set != null ? input.set - 1
                        : nextPending !== -1 ? nextPending
                        : rows.length
                    if (index > rows.length) {
                        badRequest(
                            `${exercise.name} has ${rows.length} sets in workout #${workout.id} — "set" can be at most ${rows.length + 1}`,
                        )
                    }

                    if (index === rows.length) {
                        // One more set than prescribed — append after the last.
                        const last = rows[rows.length - 1]!
                        if (input.reps == null) {
                            badRequest(
                                `All ${rows.length} prescribed sets of ${exercise.name} are done — pass "reps" to log an extra set`,
                            )
                        }
                        db.insert(tables.workoutSets)
                            .values({
                                workoutExerciseId: last.workoutExerciseId,
                                reps: input.reps,
                                weight,
                                done,
                                position: last.set.position + 1,
                            })
                            .run()
                        logged = { weight, reps: input.reps }
                    } else {
                        const target = rows[index]!.set
                        const reps = input.reps ?? target.reps
                        db.update(tables.workoutSets)
                            .set({ weight, reps, done })
                            .where(eq(tables.workoutSets.id, target.id))
                            .run()
                        logged = { weight, reps }
                    }
                    label = `${exercise.name} set ${index + 1}`
                }

                const tree = loadWorkoutTrees(userId, [workout.id])[0]!
                const { done: doneCount, total } = countSets(tree)
                return `Logged ${label}: ${formatSet({ ...logged, done })} — ${doneCount}/${total} sets done in #${workout.id} ${workout.name}`
            }),
    )

    server.registerTool(
        'finish_workout',
        {
            title: 'Finish a workout',
            description: 'Mark the workout in progress as completed.',
            inputSchema: {
                workout: z
                    .number()
                    .int()
                    .positive()
                    .optional()
                    .describe('Workout id; defaults to the one in progress'),
            },
            annotations: { destructiveHint: false, idempotentHint: true },
        },
        (input) =>
            run(() => {
                const workout = resolveWorkout(userId, input.workout)
                if (workout.completed) {
                    return `Workout #${workout.id} ${workout.name} is already completed`
                }
                useDrizzle()
                    .update(tables.workouts)
                    .set({ completed: true })
                    .where(eq(tables.workouts.id, workout.id))
                    .run()
                const tree = loadWorkoutTrees(userId, [workout.id])[0]!
                const { done, total } = countSets(tree)
                const pending =
                    done < total ? ` (${total - done} sets left pending)` : ''
                return `Finished #${workout.id} ${workout.name} — ${done}/${total} sets done${pending}`
            }),
    )

    server.registerTool(
        'get_workout',
        {
            title: 'Get a workout',
            description:
                'Full detail of one workout: every exercise with its logged sets. Defaults to the most recent workout.',
            inputSchema: {
                workout: z
                    .number()
                    .int()
                    .positive()
                    .optional()
                    .describe('Workout id; defaults to the most recent'),
            },
            annotations: { readOnlyHint: true },
        },
        (input) =>
            run(() => {
                let id = input.workout
                if (id == null) {
                    const latest = useDrizzle()
                        .select()
                        .from(tables.workouts)
                        .where(eq(tables.workouts.userId, userId))
                        .orderBy(desc(tables.workouts.startedAt))
                        .limit(1)
                        .get()
                    if (!latest) badRequest('No workouts logged yet')
                    id = latest.id
                }
                const tree = loadWorkoutTrees(userId, [id])[0]
                if (!tree) badRequest(`No workout with id ${id}`)
                return formatWorkout(tree)
            }),
    )

    server.registerTool(
        'list_workouts',
        {
            title: 'List workouts',
            description:
                'Recent workouts, newest first: id, name, date, status and a per-exercise set summary.',
            inputSchema: {
                limit: z
                    .number()
                    .int()
                    .positive()
                    .optional()
                    .describe('How many workouts (default 10)'),
            },
            annotations: { readOnlyHint: true },
        },
        (input) =>
            run(() => {
                const ids = useDrizzle()
                    .select({ id: tables.workouts.id })
                    .from(tables.workouts)
                    .where(eq(tables.workouts.userId, userId))
                    .orderBy(desc(tables.workouts.startedAt))
                    .limit(input.limit ?? 10)
                    .all()
                    .map((row) => row.id)
                if (ids.length === 0) return 'No workouts logged yet.'
                return loadWorkoutTrees(userId, ids)
                    .map(formatWorkout)
                    .join('\n\n')
            }),
    )

    server.registerTool(
        'delete_workout',
        {
            title: 'Delete a workout',
            description:
                'Permanently delete a workout and all its logged sets. Use to undo a workout logged by mistake.',
            inputSchema: {
                workout: z.number().int().positive().describe('Workout id'),
            },
            annotations: { destructiveHint: true },
        },
        (input) =>
            run(() => {
                const deleted = deleteWorkout(userId, input.workout)
                if (!deleted) badRequest(`No workout with id ${input.workout}`)
                return `Deleted workout #${deleted.id} ${deleted.name} (${toDateInput(deleted.startedAt)})`
            }),
    )
}
