import type { ExerciseInput } from '~~/shared/validation/exercise'
import type {
    Exercise,
    ExerciseDetail,
    ExerciseHistoryWorkout,
} from '../database/schema'
import { defaultLoadMode } from '~~/shared/utils/exercise'
import { exerciseInputSchema } from '~~/shared/validation/exercise'
import { firstMessage } from '~~/shared/validation/primitives'

export type { ExerciseInput }

// Validates a raw exercise payload, throwing a 400 on any malformed field.
// Shared by the create and update handlers so both enforce the same shape —
// and by the exercise form, which runs the same schema to gate its save button.
export function parseExerciseInput(
    body: Record<string, unknown>,
): ExerciseInput {
    const result = exerciseInputSchema.safeParse(body)
    if (!result.success) {
        badRequest(firstMessage(result.error, 'Invalid exercise'))
    }
    return result.data
}

/**
 * Validates and inserts a new exercise for the user, translating the unique
 * (userId, name) violation into a 409. Shared by POST /api/exercises and the
 * MCP create_exercise tool.
 */
export function createExercise(
    userId: number,
    input: Record<string, unknown>,
): Exercise {
    const values = parseExerciseInput(input)
    // Pre-load-mode clients omit the field; give their exercises the same
    // equipment-derived default the backfill gave existing rows.
    const loadMode = values.loadMode ?? defaultLoadMode(values.equipment)
    try {
        return useDrizzle()
            .insert(tables.exercises)
            .values({ ...values, loadMode, userId })
            .returning()
            .get()
    } catch (error) {
        return asDuplicateNameError(error)
    }
}

/**
 * Counts the distinct session templates and workouts still referencing the
 * exercise, so the delete-conflict message can say where it's used.
 */
export function countExerciseUsage(id: number): {
    sessions: number
    workouts: number
} {
    const db = useDrizzle()
    const sessions = db
        .select({
            n: sql<number>`count(distinct ${tables.sessionEntries.sessionId})`,
        })
        .from(tables.sessionExercises)
        .innerJoin(
            tables.sessionEntries,
            eq(tables.sessionExercises.entryId, tables.sessionEntries.id),
        )
        .where(eq(tables.sessionExercises.exerciseId, id))
        .get()
    const workouts = db
        .select({
            n: sql<number>`count(distinct ${tables.workoutEntries.workoutId})`,
        })
        .from(tables.workoutExercises)
        .innerJoin(
            tables.workoutEntries,
            eq(tables.workoutExercises.entryId, tables.workoutEntries.id),
        )
        .where(eq(tables.workoutExercises.exerciseId, id))
        .get()
    return { sessions: sessions?.n ?? 0, workouts: workouts?.n ?? 0 }
}

/**
 * Refuses exercise ids that don't belong to the user, with the same 400 the
 * parsers raise for unknown ids — another user's id and a nonexistent one are
 * indistinguishable on purpose. Backstops every tree write, since a foreign
 * key alone only checks existence, not ownership.
 */
export function assertExercisesOwned(
    tx: DbTransaction,
    userId: number,
    exerciseIds: number[],
): void {
    const unique = [...new Set(exerciseIds)]
    if (unique.length === 0) return
    const owned = tx
        .select({ id: tables.exercises.id })
        .from(tables.exercises)
        .where(
            and(
                inArray(tables.exercises.id, unique),
                eq(tables.exercises.userId, userId),
            ),
        )
        .all()
    if (owned.length !== unique.length) {
        badRequest('Unknown exercise id')
    }
}

/**
 * Loads an exercise enriched with the sessions that program it, its full
 * workout history, and its personal best. Shared by `GET /api/exercises/:id`
 * and the MCP progress tool. Throws 404 when the exercise doesn't exist —
 * including when it belongs to another user, so ids never leak existence.
 * Ownership is checked at this root only: the joins below can only reach the
 * user's own sessions and workouts, because the write paths refuse references
 * to another user's exercises.
 */
export function getExerciseDetail(id: number, userId: number): ExerciseDetail {
    const db = useDrizzle()

    const exercise = db
        .select()
        .from(tables.exercises)
        .where(
            and(
                eq(tables.exercises.id, id),
                eq(tables.exercises.userId, userId),
            ),
        )
        .get()
    if (!exercise) {
        notFound('Exercise not found')
    }

    // Session templates that program this exercise. A template can hold the
    // same movement in two entries, so dedupe to one chip per session.
    const sessionRows = db
        .select({ id: tables.sessions.id, name: tables.sessions.name })
        .from(tables.sessionExercises)
        .innerJoin(
            tables.sessionEntries,
            eq(tables.sessionExercises.entryId, tables.sessionEntries.id),
        )
        .innerJoin(
            tables.sessions,
            eq(tables.sessionEntries.sessionId, tables.sessions.id),
        )
        .where(eq(tables.sessionExercises.exerciseId, id))
        .orderBy(desc(tables.sessions.createdAt))
        .all()
    const seenSession = new Set<number>()
    const sessions = sessionRows.filter(
        (s) => !seenSession.has(s.id) && seenSession.add(s.id),
    )

    // Every workout that logged this exercise, with the loads lifted. Pulled in
    // two flat queries and stitched in memory, like the other read endpoints.
    const exerciseRows = db
        .select({ we: tables.workoutExercises, w: tables.workouts })
        .from(tables.workoutExercises)
        .innerJoin(
            tables.workoutEntries,
            eq(tables.workoutExercises.entryId, tables.workoutEntries.id),
        )
        .innerJoin(
            tables.workouts,
            eq(tables.workoutEntries.workoutId, tables.workouts.id),
        )
        .where(eq(tables.workoutExercises.exerciseId, id))
        .all()

    const workoutExerciseIds = exerciseRows.map((row) => row.we.id)
    const setRows =
        workoutExerciseIds.length > 0 ?
            db
                .select()
                .from(tables.workoutSets)
                .where(
                    inArray(
                        tables.workoutSets.workoutExerciseId,
                        workoutExerciseIds,
                    ),
                )
                .orderBy(asc(tables.workoutSets.position))
                .all()
        :   []
    const setsByWorkoutExercise = groupBy(
        setRows,
        (set) => set.workoutExerciseId,
    )

    // Merge sets under their workout (a workout could place the exercise in
    // more than one entry), then order workouts newest-first.
    const byWorkout = new Map<number, ExerciseHistoryWorkout>()
    for (const { we, w } of exerciseRows) {
        let entry = byWorkout.get(w.id)
        if (!entry) {
            entry = {
                workoutId: w.id,
                name: w.name,
                startedAt: w.startedAt,
                sets: [],
            }
            byWorkout.set(w.id, entry)
        }
        for (const set of setsByWorkoutExercise.get(we.id) ?? []) {
            entry.sets.push({
                reps: set.reps,
                weight: set.weight,
            })
        }
    }
    const history = [...byWorkout.values()].toSorted(
        (a, b) =>
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    )

    // Personal best = the heaviest load lifted, tie-broken by reps at that load.
    let best: ExerciseDetail['best'] = null
    for (const workout of history) {
        for (const set of workout.sets) {
            if (set.weight == null || set.reps == null) continue
            if (
                !best
                || set.weight > best.weight
                || (set.weight === best.weight && set.reps > best.reps)
            ) {
                best = {
                    weight: set.weight,
                    reps: set.reps,
                    workoutId: workout.workoutId,
                    name: workout.name,
                    startedAt: workout.startedAt,
                }
            }
        }
    }

    return { ...exercise, sessions, history, best }
}

// Maps SQLite's UNIQUE-violation error to a friendly 409 on the name column.
export function asDuplicateNameError(error: unknown): never {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
        conflict('An exercise with that name already exists')
    }
    throw error
}
