import type { WorkoutDetail } from '~~/server/database/schema'

defineRouteMeta({
    openAPI: {
        operationId: 'getWorkout',
        tags: ['workouts'],
        summary: 'Read one workout tree with its template status',
        parameters: [
            {
                name: 'id',
                in: 'path',
                required: true,
                description: 'The workout id',
                schema: {
                    type: 'integer',
                },
            },
        ],
        responses: {
            '200': {
                description: 'The workout tree plus template link.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/WorkoutDetail',
                        },
                    },
                },
            },
            '404': {
                description: 'Workout not found.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ApiError',
                        },
                    },
                },
            },
        },
    },
})

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
