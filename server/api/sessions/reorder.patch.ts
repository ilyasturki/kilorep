defineRouteMeta({
    openAPI: {
        operationId: 'reorderSessions',
        tags: ['sessions'],
        summary: 'Persist a manual ordering of all sessions',
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        $ref: '#/components/schemas/ReorderInput',
                    },
                },
            },
        },
        responses: {
            '200': {
                description: 'Order persisted.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/Ok',
                        },
                    },
                },
            },
            '400': {
                description: 'ids is not a permutation of every session id.',
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
    const body = await readBody<{ ids?: unknown[] }>(event)
    const ids = Array.isArray(body?.ids) ? body.ids.map(Number) : []
    if (
        ids.length === 0
        || !ids.every((id) => Number.isInteger(id) && id > 0)
    ) {
        badRequest('"ids" must be a non-empty array of session ids')
    }
    reorderSessions(userId, ids)
    return { ok: true }
})
