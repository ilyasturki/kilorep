import type { WorkoutDetail } from '~~/server/database/schema'

export default defineEventHandler((event): WorkoutDetail => {
    const userId = requireUserId(event)
    const id = getIdParam(event, 'workout')

    const workout = loadWorkoutTrees(userId, [id])[0]
    if (!workout) {
        notFound('Workout not found')
    }
    return {
        ...workout,
        template: workoutTemplateStatus(
            userId,
            workout.sessionId,
            workout.entries,
        ),
    }
})
