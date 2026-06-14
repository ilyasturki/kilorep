// Revokes a token. Scoped by userId like every query, so a foreign id reads
// as "no such token".
defineRouteMeta({
    openAPI: {
        operationId: 'revokeToken',
        tags: ['account'],
        summary: 'Revoke a token; the holder gets a 401 on its next call',
        parameters: [
            {
                name: 'id',
                in: 'path',
                required: true,
                description: 'The token id',
                schema: {
                    type: 'integer',
                },
            },
        ],
        responses: {
            '200': {
                description: 'Token revoked.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/Ok',
                        },
                    },
                },
            },
            '404': {
                description: 'No such token (or single-user instance).',
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
    requireAuthMode()
    const userId = requireUserId(event)
    const id = getIdParam(event, 'token')
    if (!deleteApiToken(userId, id)) {
        notFound(`No token with id ${id}`)
    }
    return { ok: true }
})
