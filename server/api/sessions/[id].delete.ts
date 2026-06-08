export default defineEventHandler((event) => {
    const id = getIdParam(event, 'session')

    // Entries, exercises and sets cascade away via their foreign keys.
    const deleted = useDrizzle()
        .delete(tables.sessions)
        .where(eq(tables.sessions.id, id))
        .returning()
        .get()
    if (!deleted) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Session not found',
        })
    }
    return deleted
})
