import type { WorkoutWithEntries } from '~~/server/database/schema'

export default defineEventHandler((event): WorkoutWithEntries => {
    const userId = requireUserId(event)
    const id = getIdParam(event, 'workout')

    const workout = loadWorkoutTrees(userId, [id])[0]
    if (!workout) {
        notFound('Workout not found')
    }
    return workout
})
