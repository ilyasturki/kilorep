defineRouteMeta({
    openAPI: {
        operationId: 'startWorkout',
        tags: ['workouts'],
        summary: 'Start a workout by copying a session template tree',
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        $ref: '#/components/schemas/StartWorkoutInput',
                    },
                },
            },
        },
        responses: {
            '200': {
                description:
                    'The created workout row. Fetch its tree with getWorkout.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/Workout',
                        },
                    },
                },
            },
            '400': {
                description: 'Invalid sessionId.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ApiError',
                        },
                    },
                },
            },
            '404': {
                description: 'Session not found.',
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

export default defineEventHandler(async (event) => {
    const userId = requireUserId(event)
    const body = await readBody<{ sessionId?: number }>(event)
    const sessionId = Number(body?.sessionId)
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
        badRequest('A valid "sessionId" is required')
    }

    return copySessionToWorkout(userId, sessionId)
})
