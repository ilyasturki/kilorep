export default defineEventHandler((event) => {
    const id = getIdParam(event, 'workout')

    // Entries, exercises and sets cascade away via their foreign keys.
    const deleted = useDrizzle()
        .delete(tables.workouts)
        .where(eq(tables.workouts.id, id))
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
