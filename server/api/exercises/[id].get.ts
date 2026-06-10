import type { ExerciseDetail } from '~~/server/database/schema'

export default defineEventHandler((event): ExerciseDetail => {
    const id = getIdParam(event, 'exercise')
    return getExerciseDetail(id)
})
