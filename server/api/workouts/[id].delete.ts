export default defineEventHandler((event) => {
    const userId = requireUserId(event)
    const id = getIdParam(event, 'workout')

    const deleted = deleteWorkout(userId, id)
    if (!deleted) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Workout not found',
        })
    }
    return deleted
})
