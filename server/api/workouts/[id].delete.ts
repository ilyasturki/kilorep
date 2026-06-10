export default defineEventHandler((event) => {
    const userId = requireUserId(event)
    const id = getIdParam(event, 'workout')

    // Entries, exercises and sets cascade away via their foreign keys.
    const deleted = useDrizzle()
        .delete(tables.workouts)
        .where(
            and(eq(tables.workouts.id, id), eq(tables.workouts.userId, userId)),
        )
        .returning()
        .get()
    if (!deleted) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Workout not found',
        })
    }
    return deleted
})
