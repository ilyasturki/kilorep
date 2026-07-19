import type {
    Exercise,
    LoggedSet,
    Workout,
    WorkoutEntry,
    WorkoutEntryWithExercises,
    WorkoutExercise,
    WorkoutExerciseWithSets,
    WorkoutWithEntries,
} from '~~/server/database/schema'
import { loadSchema } from '~~/shared/validation/primitives'

type LoggedSetInput = {
    reps?: number | null
    weight?: number | null
}
type WorkoutExerciseInput = { exerciseId?: number; sets?: LoggedSetInput[] }
type WorkoutEntryInput = { exercises?: WorkoutExerciseInput[] }
export type WorkoutInput = {
    name?: string
    completed?: boolean
    startedAt?: string
    entries?: WorkoutEntryInput[]
}

type ParsedLoggedSet = {
    reps: number | null
    weight: number | null
}
type ParsedExercise = { exerciseId: number; sets: ParsedLoggedSet[] }
type ParsedEntry = { exercises: ParsedExercise[] }
export type ParsedWorkout = {
    name?: string
    completed: boolean
    startedAt?: Date
    entries: ParsedEntry[]
}

/**
 * Validates and normalises a workout update payload. Mirrors `parseSessionInput`
 * but each set also carries the logged load: `weight` (kilograms, null until
 * entered). A set keeps its slot with null reps while its field is
 * cleared, so an autosave mid-edit can't silently drop the row. Exercises
 * without a valid catalog id are dropped; a 400 is thrown when nothing usable
 * remains. `name` is only returned when explicitly provided and non-empty,
 * so callers can leave the snapshot untouched.
 */
export function parseWorkoutInput(body: WorkoutInput): ParsedWorkout {
    const name = body?.name?.trim()

    const entries: ParsedEntry[] = (body?.entries ?? [])
        .map((entry) => ({
            exercises: (entry?.exercises ?? [])
                .map((ex) => ({
                    exerciseId: Number(ex?.exerciseId),
                    sets: (ex?.sets ?? []).map((set) => ({
                        reps: parseLoggedReps(set?.reps),
                        weight: loadSchema.parse(set?.weight),
                    })),
                }))
                .filter(
                    (ex) =>
                        Number.isInteger(ex.exerciseId)
                        && ex.exerciseId > 0
                        && ex.sets.length > 0,
                ),
        }))
        .filter((entry) => entry.exercises.length > 0)

    if (entries.length === 0) {
        badRequest('A workout needs at least one exercise with one set')
    }

    let startedAt: Date | undefined
    if (body?.startedAt != null) {
        startedAt = new Date(body.startedAt)
        if (Number.isNaN(startedAt.getTime())) {
            badRequest('Invalid workout "startedAt"')
        }
    }

    return {
        name: name || undefined,
        completed: Boolean(body?.completed),
        startedAt,
        entries,
    }
}

/**
 * Inserts the entry/exercise/set tree for a workout row, inside the caller's
 * transaction so the row and its tree commit (or roll back) together; array
 * index becomes the stored `position`. `userId` guards the referenced
 * exercises — a payload may only log the user's own catalog. Internal to the
 * write operations below; transports call `createWorkout` or `saveWorkout`.
 */
function writeWorkoutEntries(
    tx: DbTransaction,
    userId: number,
    workoutId: number,
    entries: ParsedEntry[],
) {
    assertExercisesOwned(
        tx,
        userId,
        entries.flatMap((entry) => entry.exercises.map((ex) => ex.exerciseId)),
    )

    entries.forEach((entry, entryIndex) => {
        const entryRow = tx
            .insert(tables.workoutEntries)
            .values({ workoutId, position: entryIndex })
            .returning()
            .get()

        entry.exercises.forEach((ex, exIndex) => {
            const exerciseRow = tx
                .insert(tables.workoutExercises)
                .values({
                    entryId: entryRow.id,
                    exerciseId: ex.exerciseId,
                    position: exIndex,
                })
                .returning()
                .get()

            tx.insert(tables.workoutSets)
                .values(
                    ex.sets.map((set, setIndex) => ({
                        workoutExerciseId: exerciseRow.id,
                        reps: set.reps,
                        weight: set.weight,
                        position: setIndex,
                    })),
                )
                .run()
        })
    })
}

/**
 * Creates a workout row from a parsed payload and writes its tree, in one
 * transaction it owns. `sessionId` links the workout to a template (null for an
 * ad-hoc log); `defaultName` names it when the payload left `name` blank — the
 * caller passes the template's name there. The load is whatever the payload
 * carries, so this is the "log it after the fact" path, not the template copy.
 */
export function createWorkout(
    userId: number,
    parsed: ParsedWorkout,
    sessionId: number | null = null,
    defaultName = 'Workout',
): Workout {
    return useDrizzle().transaction((tx) => {
        const row = tx
            .insert(tables.workouts)
            .values({
                userId,
                sessionId,
                name: parsed.name ?? defaultName,
                startedAt: parsed.startedAt ?? new Date(),
                completed: parsed.completed,
            })
            .returning()
            .get()
        writeWorkoutEntries(tx, userId, row.id, parsed.entries)
        return row
    })
}

/**
 * Replaces an existing workout's row fields and its whole logged tree, in one
 * transaction it owns. 404s when the workout isn't the user's. The tree is
 * replaced rather than diffed — the simplest correct way to persist arbitrary
 * add/remove/reorder edits; deleting the entries cascades to their exercises
 * and sets. `name` is left untouched unless the payload sets one; the original
 * time-of-day is kept when only the calendar day moved.
 */
export function saveWorkout(
    userId: number,
    id: number,
    parsed: ParsedWorkout,
): Workout {
    return useDrizzle().transaction((tx) => {
        const existing = tx
            .select()
            .from(tables.workouts)
            .where(
                and(
                    eq(tables.workouts.id, id),
                    eq(tables.workouts.userId, userId),
                ),
            )
            .get()
        if (!existing) {
            notFound('Workout not found')
        }

        const row = tx
            .update(tables.workouts)
            .set({
                ...(parsed.name ? { name: parsed.name } : {}),
                startedAt: parsed.startedAt ?? existing.startedAt,
                completed: parsed.completed,
            })
            .where(eq(tables.workouts.id, id))
            .returning()
            .get()

        tx.delete(tables.workoutEntries)
            .where(eq(tables.workoutEntries.workoutId, id))
            .run()
        writeWorkoutEntries(tx, userId, id, parsed.entries)

        return row
    })
}

/**
 * The reps of each exercise's most recent workout that logged any, in set
 * order — the seed for open-target sets when a template is copied. Ranking
 * by workout recency per exercise inside SQLite keeps the result at one
 * workout's sets per exercise instead of shipping the full history out.
 */
function lastLoggedReps(
    tx: DbTransaction,
    userId: number,
    exerciseIds: number[],
): Map<number, number[]> {
    const result = new Map<number, number[]>()
    if (exerciseIds.length === 0) return result

    const ranked = tx
        .select({
            exerciseId: tables.workoutExercises.exerciseId,
            reps: tables.workoutSets.reps,
            entryPosition: tables.workoutEntries.position,
            exercisePosition: tables.workoutExercises.position,
            setPosition: tables.workoutSets.position,
            // Sets of the same workout tie, so an exercise's whole newest
            // qualifying workout ranks 1.
            recency:
                sql<number>`dense_rank() over (partition by ${tables.workoutExercises.exerciseId} order by ${tables.workouts.startedAt} desc, ${tables.workouts.id} desc)`.as(
                    'recency',
                ),
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
            eq(tables.workoutExercises.entryId, tables.workoutEntries.id),
        )
        .innerJoin(
            tables.workouts,
            eq(tables.workoutEntries.workoutId, tables.workouts.id),
        )
        .where(
            and(
                eq(tables.workouts.userId, userId),
                inArray(tables.workoutExercises.exerciseId, exerciseIds),
                isNotNull(tables.workoutSets.reps),
            ),
        )
        .as('ranked')

    const rows = tx
        .select({ exerciseId: ranked.exerciseId, reps: ranked.reps })
        .from(ranked)
        .where(eq(ranked.recency, 1))
        .orderBy(
            asc(ranked.entryPosition),
            asc(ranked.exercisePosition),
            asc(ranked.setPosition),
        )
        .all()

    for (const row of rows) {
        const reps = result.get(row.exerciseId) ?? []
        reps.push(row.reps!)
        result.set(row.exerciseId, reps)
    }
    return result
}

/**
 * Creates a workout by copying a template's tree. The template's rep targets
 * seed each set's reps; the load is left blank (`weight` null) for the lifter to
 * fill in. An open target (null reps) seeds from the lifter's last logged reps
 * for that exercise instead, staying blank when there is no history. The copy
 * means later edits to the template never touch this history. Throws 404 when
 * the template is gone. Owns its transaction so the new workout and its whole
 * seeded tree commit together.
 */
export function copySessionToWorkout(
    userId: number,
    sessionId: number,
): Workout {
    return useDrizzle().transaction((tx) => {
        const session = tx
            .select()
            .from(tables.sessions)
            .where(
                and(
                    eq(tables.sessions.id, sessionId),
                    eq(tables.sessions.userId, userId),
                ),
            )
            .get()
        if (!session) {
            notFound('Session not found')
        }

        const entries = tx
            .select()
            .from(tables.sessionEntries)
            .where(eq(tables.sessionEntries.sessionId, sessionId))
            .orderBy(asc(tables.sessionEntries.position))
            .all()
        const entryIds = entries.map((e) => e.id)
        const sessionExercises =
            entryIds.length > 0 ?
                tx
                    .select()
                    .from(tables.sessionExercises)
                    .where(inArray(tables.sessionExercises.entryId, entryIds))
                    .orderBy(asc(tables.sessionExercises.position))
                    .all()
            :   []
        const exerciseIds = sessionExercises.map((e) => e.id)
        const templateSets =
            exerciseIds.length > 0 ?
                tx
                    .select()
                    .from(tables.sets)
                    .where(inArray(tables.sets.sessionExerciseId, exerciseIds))
                    .orderBy(asc(tables.sets.position))
                    .all()
            :   []
        const setsByExercise = groupBy(templateSets, (s) => s.sessionExerciseId)
        const exercisesByEntry = groupBy(sessionExercises, (e) => e.entryId)

        const openExerciseIds = [
            ...new Set(
                sessionExercises
                    .filter((ex) =>
                        (setsByExercise.get(ex.id) ?? []).some(
                            (set) => set.reps == null,
                        ),
                    )
                    .map((ex) => ex.exerciseId),
            ),
        ]
        const lastRepsByExercise = lastLoggedReps(tx, userId, openExerciseIds)

        const workout = tx
            .insert(tables.workouts)
            .values({ userId, name: session.name, sessionId: session.id })
            .returning()
            .get()

        entries.forEach((entry, entryIndex) => {
            const entryRow = tx
                .insert(tables.workoutEntries)
                .values({ workoutId: workout.id, position: entryIndex })
                .returning()
                .get()

            const exercises = exercisesByEntry.get(entry.id) ?? []
            exercises.forEach((ex, exIndex) => {
                const exerciseRow = tx
                    .insert(tables.workoutExercises)
                    .values({
                        entryId: entryRow.id,
                        exerciseId: ex.exerciseId,
                        position: exIndex,
                    })
                    .returning()
                    .get()

                const sets = setsByExercise.get(ex.id) ?? []
                if (sets.length > 0) {
                    // The last set's reps cover positions beyond the history.
                    const lastReps = lastRepsByExercise.get(ex.exerciseId)
                    tx.insert(tables.workoutSets)
                        .values(
                            sets.map((set, setIndex) => ({
                                workoutExerciseId: exerciseRow.id,
                                reps:
                                    set.reps
                                    ?? lastReps?.[setIndex]
                                    ?? lastReps?.at(-1)
                                    ?? null,
                                weight: null,
                                position: setIndex,
                            })),
                        )
                        .run()
                }
            })
        })

        return workout
    })
}

/**
 * Stitches flat rows into the nested workout tree the API returns. Shared by the
 * list and detail endpoints so both shape data identically.
 */
export function stitchWorkoutTree(
    workouts: Workout[],
    entries: WorkoutEntry[],
    exercises: { workoutExercise: WorkoutExercise; exercise: Exercise }[],
    sets: LoggedSet[],
): WorkoutWithEntries[] {
    const setsByExercise = groupBy(sets, (set) => set.workoutExerciseId)

    const resolvedExercises: WorkoutExerciseWithSets[] = []
    for (const { workoutExercise, exercise } of exercises) {
        resolvedExercises.push({
            ...workoutExercise,
            exercise,
            sets: setsByExercise.get(workoutExercise.id) ?? [],
        })
    }
    const exercisesByEntry = groupBy(resolvedExercises, (e) => e.entryId)

    const resolvedEntries: WorkoutEntryWithExercises[] = []
    for (const entry of entries) {
        resolvedEntries.push({
            ...entry,
            exercises: exercisesByEntry.get(entry.id) ?? [],
        })
    }
    const entriesByWorkout = groupBy(resolvedEntries, (e) => e.workoutId)

    return workouts.map((workout) => ({
        ...workout,
        entries: entriesByWorkout.get(workout.id) ?? [],
    }))
}

/**
 * Loads full workout trees for the given ids (the user's own only), newest
 * first. Four flat reads then a stitch: per-user data stays small, so this
 * beats a fanned-out join or Drizzle's relational layer. Shared by the REST
 * handlers and the MCP tools so both shape data identically.
 */
export function loadWorkoutTrees(
    userId: number,
    ids: number[],
): WorkoutWithEntries[] {
    if (ids.length === 0) return []
    const db = useDrizzle()

    const workouts = db
        .select()
        .from(tables.workouts)
        .where(
            and(
                inArray(tables.workouts.id, ids),
                eq(tables.workouts.userId, userId),
            ),
        )
        .orderBy(desc(tables.workouts.startedAt))
        .all()
    const ownedIds = workouts.map((workout) => workout.id)
    if (ownedIds.length === 0) return []
    const entries = db
        .select()
        .from(tables.workoutEntries)
        .where(inArray(tables.workoutEntries.workoutId, ownedIds))
        .orderBy(asc(tables.workoutEntries.position))
        .all()
    const entryIds = entries.map((entry) => entry.id)
    const exercises =
        entryIds.length > 0 ?
            db
                .select({
                    workoutExercise: tables.workoutExercises,
                    exercise: tables.exercises,
                })
                .from(tables.workoutExercises)
                .innerJoin(
                    tables.exercises,
                    eq(tables.workoutExercises.exerciseId, tables.exercises.id),
                )
                .where(inArray(tables.workoutExercises.entryId, entryIds))
                .orderBy(asc(tables.workoutExercises.position))
                .all()
        :   []
    const exerciseIds = exercises.map((row) => row.workoutExercise.id)
    const sets =
        exerciseIds.length > 0 ?
            db
                .select()
                .from(tables.workoutSets)
                .where(
                    inArray(tables.workoutSets.workoutExerciseId, exerciseIds),
                )
                .orderBy(asc(tables.workoutSets.position))
                .all()
        :   []

    return stitchWorkoutTree(workouts, entries, exercises, sets)
}

/**
 * Deletes a workout the user owns, returning the deleted row or undefined
 * when no owned workout matches. Entries, exercises and sets cascade away
 * via their foreign keys. Each caller maps the miss to its own error shape.
 */
export function deleteWorkout(userId: number, id: number): Workout | undefined {
    return useDrizzle()
        .delete(tables.workouts)
        .where(
            and(eq(tables.workouts.id, id), eq(tables.workouts.userId, userId)),
        )
        .returning()
        .get()
}
