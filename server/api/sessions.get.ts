import type {
    SessionExerciseWithSets,
    SessionWithEntries,
} from '~~/server/database/schema'

export default defineEventHandler((event): SessionWithEntries[] => {
    const userId = requireUserId(event)
    const db = useDrizzle()

    const sessions = db
        .select()
        .from(tables.sessions)
        .where(eq(tables.sessions.userId, userId))
        .orderBy(desc(tables.sessions.createdAt))
        .all()
    if (sessions.length === 0) return []

    // Pull the whole tree in four flat queries and stitch it together in memory:
    // per-user data stays small, so this beats a join with row fan-out or
    // setting up Drizzle's relational layer just for one read.
    const sessionIds = sessions.map((session) => session.id)
    const entries = db
        .select()
        .from(tables.sessionEntries)
        .where(inArray(tables.sessionEntries.sessionId, sessionIds))
        .orderBy(asc(tables.sessionEntries.position))
        .all()
    const entryIds = entries.map((entry) => entry.id)
    const sessionExercises =
        entryIds.length > 0 ?
            db
                .select({
                    sessionExercise: tables.sessionExercises,
                    exercise: tables.exercises,
                })
                .from(tables.sessionExercises)
                .innerJoin(
                    tables.exercises,
                    eq(tables.sessionExercises.exerciseId, tables.exercises.id),
                )
                .where(inArray(tables.sessionExercises.entryId, entryIds))
                .orderBy(asc(tables.sessionExercises.position))
                .all()
        :   []
    const exerciseIds = sessionExercises.map((row) => row.sessionExercise.id)
    const sets =
        exerciseIds.length > 0 ?
            db
                .select()
                .from(tables.sets)
                .where(inArray(tables.sets.sessionExerciseId, exerciseIds))
                .orderBy(asc(tables.sets.position))
                .all()
        :   []

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
        ...session,
        entries: entriesBySession.get(session.id) ?? [],
    }))
})
