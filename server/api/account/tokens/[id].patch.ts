// Renames a token. The util owns the label rules (trim, cap, non-empty).
defineRouteMeta({
    openAPI: {
        operationId: 'renameToken',
        tags: ['account'],
        summary: 'Rename a token',
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
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        $ref: '#/components/schemas/TokenRenameInput',
                    },
                },
            },
        },
        responses: {
            '200': {
                description: 'The renamed token.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ApiTokenInfo',
                        },
                    },
                },
            },
            '400': {
                description: 'Empty label.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ApiError',
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

export default defineEventHandler(async (event) => {
    requireAuthMode()
    const userId = requireUserId(event)
    const id = getIdParam(event, 'token')
    const body = (await readBody<Record<string, unknown>>(event)) ?? {}
    const record = renameApiToken(userId, id, body.label)
    if (!record) notFound(`No token with id ${id}`)
    return record
})
