import type {
    SessionExerciseWithSets,
    SessionWithEntries,
} from '~~/server/database/schema'

type SetInput = { reps?: number | null }
type ExerciseInput = { exerciseId?: number; sets?: SetInput[] }
type EntryInput = { exercises?: ExerciseInput[] }
export type SessionInput = {
    name?: string
    entries?: EntryInput[]
}

type ParsedExercise = {
    exerciseId: number
    sets: { reps: number | null }[]
}
type ParsedEntry = { exercises: ParsedExercise[] }
export type ParsedSession = {
    name: string
    entries: ParsedEntry[]
}

/**
 * A usable rep target is a positive finite number; anything else (cleared
 * field, zero, junk) normalises to null — an open target. Shared by the
 * session and workout payload parsers so both draw the same line.
 */
export function parseRepsTarget(value: unknown): number | null {
    const reps = Number(value)
    return Number.isFinite(reps) && reps > 0 ? reps : null
}

/**
 * Validates and normalises a create/update payload, dropping incomplete rows
 * (exercises without a valid catalog id) and throwing a 400 when nothing
 * usable remains. A set without positive reps keeps its slot with a null
 * target — the rep count is then decided at workout time. Shared by POST and
 * PUT so both enforce the same shape.
 */
export function parseSessionInput(body: SessionInput): ParsedSession {
    const name = body?.name?.trim()
    if (!name) badRequest('A session "name" is required')

    const entries: ParsedEntry[] = (body?.entries ?? [])
        .map((entry) => ({
            exercises: (entry?.exercises ?? [])
                .map((ex) => ({
                    exerciseId: Number(ex?.exerciseId),
                    sets: (ex?.sets ?? []).map((set) => ({
                        reps: parseRepsTarget(set?.reps),
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

/**
 * Inserts a session row with its full tree in one transaction. Shared by
 * POST /api/sessions, the MCP create_session_template tool, and the
 * workout-to-template handler — the latter passes its own `tx` so the
 * session and the workout re-point commit together.
 */
export function createSessionTree(
    userId: number,
    parsed: ParsedSession,
    tx?: DbTransaction,
) {
    const create = (tx: DbTransaction) => {
        const minPosition = tx
            .select({
                value: sql<number | null>`min(${tables.sessions.position})`,
            })
            .from(tables.sessions)
            .where(eq(tables.sessions.userId, userId))
            .get()?.value

        const session = tx
            .insert(tables.sessions)
            .values({
                name: parsed.name,
                userId,
                position: (minPosition ?? 1) - 1,
            })
            .returning()
            .get()

        writeSessionEntries(tx, userId, session.id, parsed.entries)
        return session
    }
    return tx ? create(tx) : useDrizzle().transaction(create)
}

/**
 * Renames a session and rewrites its whole tree — replacing rather than
 * diffing is the simplest correct way to persist arbitrary add/remove/reorder
 * edits; deleting the entries cascades to their exercises and sets. 404s when
 * the session isn't the user's. Shared by PUT /api/sessions/:id and the MCP
 * update_session_template tool.
 */
export function replaceSessionTree(
    userId: number,
    id: number,
    parsed: ParsedSession,
) {
    return useDrizzle().transaction((tx) => {
        const updated = tx
            .update(tables.sessions)
            .set({ name: parsed.name })
            .where(
                and(
                    eq(tables.sessions.id, id),
                    eq(tables.sessions.userId, userId),
                ),
            )
            .returning()
            .get()
        if (!updated) notFound('Session not found')

        tx.delete(tables.sessionEntries)
            .where(eq(tables.sessionEntries.sessionId, id))
            .run()
        writeSessionEntries(tx, userId, id, parsed.entries)

        return updated
    })
}

/**
 * Persists a manual ordering of the user's sessions. `ids` must be a
 * permutation of the user's session ids — requiring the full list keeps the
 * stored order total and rejects a stale client that is missing a session.
 */
export function reorderSessions(userId: number, ids: number[]) {
    return useDrizzle().transaction((tx) => {
        const owned = tx
            .select({ id: tables.sessions.id })
            .from(tables.sessions)
            .where(eq(tables.sessions.userId, userId))
            .all()
            .map((row) => row.id)
        const unique = new Set(ids)
        if (
            unique.size !== ids.length
            || owned.length !== ids.length
            || !owned.every((id) => unique.has(id))
        ) {
            badRequest('"ids" must list every session id exactly once')
        }
        ids.forEach((id, index) => {
            tx.update(tables.sessions)
                .set({ position: index })
                .where(eq(tables.sessions.id, id))
                .run()
        })
    })
}

/**
 * Loads the user's sessions as full trees (entries → exercises → sets),
 * in manual `position` order; `ids` narrows the read to specific sessions.
 * Pulls the data in four flat queries and stitches it together in memory:
 * per-user data stays small, so this beats a join with row fan-out or
 * setting up Drizzle's relational layer just for one read.
 */
export function loadSessionTrees(
    userId: number,
    ids?: number[],
): SessionWithEntries[] {
    const db = useDrizzle()

    const sessions = db
        .select()
        .from(tables.sessions)
        .where(
            ids ?
                and(
                    eq(tables.sessions.userId, userId),
                    inArray(tables.sessions.id, ids),
                )
            :   eq(tables.sessions.userId, userId),
        )
        .orderBy(asc(tables.sessions.position), desc(tables.sessions.createdAt))
        .all()
    if (sessions.length === 0) return []

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
}
