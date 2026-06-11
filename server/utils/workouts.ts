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

type LoggedSetInput = { reps?: number; weight?: number | null; done?: boolean }
type WorkoutExerciseInput = { exerciseId?: number; sets?: LoggedSetInput[] }
type WorkoutEntryInput = { exercises?: WorkoutExerciseInput[] }
export type WorkoutInput = {
    name?: string
    completed?: boolean
    startedAt?: string
    entries?: WorkoutEntryInput[]
}

type ParsedLoggedSet = { reps: number; weight: number | null; done: boolean }
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
 * entered) and `done`. Incomplete rows are dropped; a 400 is thrown when nothing
 * usable remains. `name` is only returned when explicitly provided and non-empty,
 * so callers can leave the snapshot untouched.
 */
export function parseWorkoutInput(body: WorkoutInput): ParsedWorkout {
    const name = body?.name?.trim()

    const entries: ParsedEntry[] = (body?.entries ?? [])
        .map((entry) => ({
            exercises: (entry?.exercises ?? [])
                .map((ex) => ({
                    exerciseId: Number(ex?.exerciseId),
                    sets: (ex?.sets ?? [])
                        .map((set) => {
                            const weight = Number(set?.weight)
                            return {
                                reps: Number(set?.reps),
                                weight:
                                    (
                                        set?.weight == null
                                        || !Number.isFinite(weight)
                                        || weight < 0
                                    ) ?
                                        null
                                    :   weight,
                                done: Boolean(set?.done),
                            }
                        })
                        .filter(
                            (set) => Number.isFinite(set.reps) && set.reps > 0,
                        ),
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
 * Inserts the entry/exercise/set tree for an existing workout row. The caller
 * owns the transaction so the workout and its tree commit (or roll back)
 * together; array index becomes the stored `position`. `userId` guards the
 * referenced exercises — a payload may only log the user's own catalog.
 */
export function writeWorkoutEntries(
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
                        done: set.done,
                        position: setIndex,
                    })),
                )
                .run()
        })
    })
}

/**
 * Creates a workout by copying a template's tree. The template's rep targets
 * seed each set's reps; the load is left blank (`weight` null) for the lifter to
 * fill in. The copy means later edits to the template never touch this history.
 * Throws 404 when the template is gone. Caller owns the transaction.
 */
export function copySessionToWorkout(
    tx: DbTransaction,
    userId: number,
    sessionId: number,
): Workout {
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
                tx.insert(tables.workoutSets)
                    .values(
                        sets.map((set, setIndex) => ({
                            workoutExerciseId: exerciseRow.id,
                            reps: set.reps,
                            weight: null,
                            done: false,
                            position: setIndex,
                        })),
                    )
                    .run()
            }
        })
    })

    return workout
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
