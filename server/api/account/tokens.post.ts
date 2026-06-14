// Mints an MCP bearer token (see settings page). The cleartext in the
// response is the only time it ever leaves the server.
defineRouteMeta({
    openAPI: {
        operationId: 'createToken',
        tags: ['account'],
        summary: 'Mint a bearer token',
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        $ref: '#/components/schemas/TokenCreateInput',
                    },
                },
            },
        },
        responses: {
            '200': {
                description:
                    'The minted token; the cleartext never leaves the server again.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/TokenGrant',
                        },
                    },
                },
            },
            '400': {
                description: 'Token limit reached.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ApiError',
                        },
                    },
                },
            },
            '404': {
                description: 'Single-user instance: tokens do not exist.',
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
    requireAuthMode()
    const userId = requireUserId(event)
    const body = (await readBody<Record<string, unknown>>(event)) ?? {}
    return createApiToken(userId, body.label)
})
