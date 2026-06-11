export default defineEventHandler((event) => {
    const userId = requireUserId(event)
    const id = getIdParam(event, 'session')

    // Entries, exercises and sets cascade away via their foreign keys.
    const deleted = useDrizzle()
        .delete(tables.sessions)
        .where(
            and(eq(tables.sessions.id, id), eq(tables.sessions.userId, userId)),
        )
        .returning()
        .get()
    if (!deleted) {
        notFound('Session not found')
    }
    return deleted
})
