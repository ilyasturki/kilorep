defineRouteMeta({
    openAPI: {
        operationId: 'logBodyweight',
        tags: ['bodyweight'],
        summary: 'Log the weigh-in for a day (re-logging overwrites it)',
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        $ref: '#/components/schemas/BodyweightInput',
                    },
                },
            },
        },
        responses: {
            '200': {
                description: 'The created or overwritten weigh-in.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/Bodyweight',
                        },
                    },
                },
            },
            '400': {
                description:
                    'Invalid date (or in the future), or weight out of range.',
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
    return upsertBodyweight(userId, parseBodyweightInput(body))
})
