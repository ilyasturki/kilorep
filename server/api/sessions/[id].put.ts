export default defineEventHandler(async (event) => {
    const userId = requireUserId(event)
    const id = getIdParam(event, 'session')

    const parsed = parseSessionInput(await readBody<SessionInput>(event))

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
        if (!updated) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Session not found',
            })
        }

        // Replace the whole tree rather than diffing: the simplest correct way
        // to persist arbitrary add/remove/reorder edits. Deleting the entries
        // cascades to their exercises and sets.
        tx.delete(tables.sessionEntries)
            .where(eq(tables.sessionEntries.sessionId, id))
            .run()
        writeSessionEntries(tx, userId, id, parsed.entries)

        return updated
    })
})
