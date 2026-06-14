defineRouteMeta({
    openAPI: {
        operationId: 'createSession',
        tags: ['sessions'],
        summary: 'Create a session template with its full tree',
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        $ref: '#/components/schemas/SessionInput',
                    },
                },
            },
        },
        responses: {
            '200': {
                description:
                    'The created session row, positioned on top of the list.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/Session',
                        },
                    },
                },
            },
            '400': {
                description: 'Missing name or no usable exercise/set.',
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
    const parsed = parseSessionInput(await readBody<SessionInput>(event))
    return createSessionTree(userId, parsed)
})
