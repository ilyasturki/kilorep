defineRouteMeta({
    openAPI: {
        operationId: 'createExercise',
        tags: ['exercises'],
        summary: 'Create a catalog exercise',
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        $ref: '#/components/schemas/ExerciseInput',
                    },
                },
            },
        },
        responses: {
            '200': {
                description: 'The created exercise.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/Exercise',
                        },
                    },
                },
            },
            '400': {
                description: 'Malformed name, equipment, type or muscles.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ApiError',
                        },
                    },
                },
            },
            '409': {
                description: 'An exercise with that name already exists.',
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
    const body = (await readBody<Record<string, unknown>>(event)) ?? {}
    return createExercise(userId, body)
})
