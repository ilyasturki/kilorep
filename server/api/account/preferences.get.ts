// The signed-in user's display preferences. Scoped by userId, so it answers in
// both auth modes.
defineRouteMeta({
    openAPI: {
        operationId: 'getAccountPreferences',
        tags: ['account'],
        summary: 'Read the display preferences',
        responses: {
            '200': {
                description: 'The current display preferences.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/AccountPreferences',
                        },
                    },
                },
            },
        },
    },
})

export default defineEventHandler((event) => {
    const userId = requireUserId(event)
    return { locale: getUserLocale(userId) }
})
