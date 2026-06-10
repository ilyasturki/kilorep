type SetInput = { reps?: number }
type ExerciseInput = { exerciseId?: number; sets?: SetInput[] }
type EntryInput = { exercises?: ExerciseInput[] }
export type SessionInput = {
    name?: string
    entries?: EntryInput[]
}

type ParsedExercise = {
    exerciseId: number
    sets: { reps: number }[]
}
type ParsedEntry = { exercises: ParsedExercise[] }
export type ParsedSession = {
    name: string
    entries: ParsedEntry[]
}

/**
 * Validates and normalises a create/update payload, dropping incomplete rows
 * (exercises without a valid catalog id, sets without positive reps) and
 * throwing a 400 when nothing usable remains. Shared by POST and PUT so both
 * enforce the same shape.
 */
export function parseSessionInput(body: SessionInput): ParsedSession {
    const name = body?.name?.trim()
    if (!name) badRequest('A session "name" is required')

    const entries: ParsedEntry[] = (body?.entries ?? [])
        .map((entry) => ({
            exercises: (entry?.exercises ?? [])
                .map((ex) => ({
                    exerciseId: Number(ex?.exerciseId),
                    sets: (ex?.sets ?? [])
                        .map((set) => ({ reps: Number(set?.reps) }))
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
        badRequest('A session needs at least one exercise with one set')
    }

    return { name, entries }
}

/**
 * Inserts the entry/exercise/set tree for an existing session row. The caller
 * owns the transaction so the session and its tree commit (or roll back)
 * together; array index becomes the stored `position`. `userId` guards the
 * referenced exercises — a payload may only program the user's own catalog.
 */
export function writeSessionEntries(
    tx: DbTransaction,
    userId: number,
    sessionId: number,
    entries: ParsedEntry[],
) {
    assertExercisesOwned(
        tx,
        userId,
        entries.flatMap((entry) => entry.exercises.map((ex) => ex.exerciseId)),
    )

    entries.forEach((entry, entryIndex) => {
        const entryRow = tx
            .insert(tables.sessionEntries)
            .values({ sessionId, position: entryIndex })
            .returning()
            .get()

        entry.exercises.forEach((ex, exIndex) => {
            const exerciseRow = tx
                .insert(tables.sessionExercises)
                .values({
                    entryId: entryRow.id,
                    exerciseId: ex.exerciseId,
                    position: exIndex,
                })
                .returning()
                .get()

            tx.insert(tables.sets)
                .values(
                    ex.sets.map((set, setIndex) => ({
                        sessionExerciseId: exerciseRow.id,
                        reps: set.reps,
                        position: setIndex,
                    })),
                )
                .run()
        })
    })
}
