export default defineEventHandler((event) => {
    const id = getIdParam(event, 'exercise')

    let deleted
    try {
        // session_exercises references this row without a cascade, so SQLite
        // refuses the delete while any session still uses the exercise.
        deleted = useDrizzle()
            .delete(tables.exercises)
            .where(eq(tables.exercises.id, id))
            .returning()
            .get()
    } catch (error) {
        if (error instanceof Error && error.message.includes('FOREIGN KEY')) {
            throw createError({
                statusCode: 409,
                statusMessage:
                    "This exercise is used in a session and can't be deleted",
            })
        }
        throw error
    }

    if (!deleted) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Exercise not found',
        })
    }
    return deleted
})
