defineRouteMeta({
    openAPI: {
        operationId: 'replaceSession',
        tags: ['sessions'],
        summary: 'Rename a session and replace its whole tree',
        parameters: [
            {
                name: 'id',
                in: 'path',
                required: true,
                description: 'The session id',
                schema: {
                    type: 'integer',
                },
            },
        ],
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
                description: 'The updated session row.',
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
    const id = getIdParam(event, 'session')
    const parsed = parseSessionInput(await readBody<SessionInput>(event))
    return replaceSessionTree(userId, id, parsed)
})
