export default defineEventHandler((event) => {
    const userId = requireUserId(event)
    const id = getIdParam(event, 'workout')

    const deleted = deleteWorkout(userId, id)
    if (!deleted) {
        notFound('Workout not found')
    }
    return deleted
})
