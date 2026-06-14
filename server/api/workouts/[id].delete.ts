defineRouteMeta({
    openAPI: {
        operationId: 'deleteWorkout',
        tags: ['workouts'],
        summary: 'Delete a workout and its logged tree',
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
                description: 'The deleted workout row.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/Workout',
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

export default defineEventHandler((event) => {
    const userId = requireUserId(event)
    const id = getIdParam(event, 'workout')

    const deleted = deleteWorkout(userId, id)
    if (!deleted) {
        notFound('Workout not found')
    }
    return deleted
})
