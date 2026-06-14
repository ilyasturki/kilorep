// Lists the user's MCP tokens — metadata only; the secret exists nowhere to
// return. Auth mode only: without auth configured, /mcp is already open
// inside the instance's own network boundary and tokens would be theater.
defineRouteMeta({
    openAPI: {
        operationId: 'listTokens',
        tags: ['account'],
        summary: 'List API/device tokens (metadata only)',
        responses: {
            '200': {
                description: 'Every token the account holds.',
                content: {
                    'application/json': {
                        schema: {
                            type: 'array',
                            items: {
                                $ref: '#/components/schemas/ApiTokenInfo',
                            },
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

export default defineEventHandler((event) => {
    requireAuthMode()
    const userId = requireUserId(event)
    return listApiTokens(userId)
})
