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

// The handle passed to `db.transaction(tx => …)`, derived from useDrizzle so it
// stays correct if the driver changes.
type WorkoutTx = Parameters<
    Parameters<ReturnType<typeof useDrizzle>['transaction']>[0]
>[0]

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
 * together; array index becomes the stored `position`.
 */
export function writeWorkoutEntries(
    tx: WorkoutTx,
    workoutId: number,
    entries: ParsedEntry[],
) {
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
    tx: WorkoutTx,
    sessionId: number,
): Workout {
    const session = tx
        .select()
        .from(tables.sessions)
        .where(eq(tables.sessions.id, sessionId))
        .get()
    if (!session) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Session not found',
        })
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
        .values({ name: session.name, sessionId: session.id })
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
