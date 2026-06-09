import type {
    SessionExerciseWithSets,
    SessionWithEntries,
} from '~~/server/database/schema'

export default defineEventHandler((): SessionWithEntries[] => {
    const db = useDrizzle()

    const sessions = db
        .select()
        .from(tables.sessions)
        .orderBy(desc(tables.sessions.createdAt))
        .all()
    if (sessions.length === 0) return []

    // Pull the whole tree in four flat queries and stitch it together in memory:
    // single-user data stays small, so this beats a join with row fan-out or
    // setting up Drizzle's relational layer just for one read.
    const entries = db
        .select()
        .from(tables.sessionEntries)
        .orderBy(asc(tables.sessionEntries.position))
        .all()
    const sessionExercises = db
        .select({
            sessionExercise: tables.sessionExercises,
            exercise: tables.exercises,
        })
        .from(tables.sessionExercises)
        .innerJoin(
            tables.exercises,
            eq(tables.sessionExercises.exerciseId, tables.exercises.id),
        )
        .orderBy(asc(tables.sessionExercises.position))
        .all()
    const sets = db
        .select()
        .from(tables.sets)
        .orderBy(asc(tables.sets.position))
        .all()

    const setsByExercise = groupBy(sets, (set) => set.sessionExerciseId)

    const resolvedExercises: SessionExerciseWithSets[] = []
    for (const { sessionExercise, exercise } of sessionExercises) {
        resolvedExercises.push({
            ...sessionExercise,
            exercise,
            sets: setsByExercise.get(sessionExercise.id) ?? [],
        })
    }
    const exercisesByEntry = groupBy(resolvedExercises, (se) => se.entryId)

    const resolvedEntries: SessionWithEntries['entries'] = []
    for (const entry of entries) {
        resolvedEntries.push({
            ...entry,
            exercises: exercisesByEntry.get(entry.id) ?? [],
        })
    }
    const entriesBySession = groupBy(
        resolvedEntries,
        (entry) => entry.sessionId,
    )

    return sessions.map((session) => ({
        id: session.id,
        name: session.name,
        createdAt: session.createdAt,
        entries: entriesBySession.get(session.id) ?? [],
    }))
})
