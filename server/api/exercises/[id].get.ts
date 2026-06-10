import type { ExerciseDetail } from '~~/server/database/schema'

export default defineEventHandler((event): ExerciseDetail => {
    const userId = requireUserId(event)
    const id = getIdParam(event, 'exercise')
    return getExerciseDetail(id, userId)
})
