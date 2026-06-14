defineRouteMeta({
    openAPI: {
        operationId: 'listBodyweight',
        tags: ['bodyweight'],
        summary: 'List all weigh-ins, oldest first',
        responses: {
            '200': {
                description: 'Every weigh-in.',
                content: {
                    'application/json': {
                        schema: {
                            type: 'array',
                            items: {
                                $ref: '#/components/schemas/Bodyweight',
                            },
                        },
                    },
                },
            },
        },
    },
})

export default defineEventHandler((event) => {
    const userId = requireUserId(event)
    return useDrizzle()
        .select()
        .from(tables.bodyweight)
        .where(eq(tables.bodyweight.userId, userId))
        .orderBy(asc(tables.bodyweight.date))
        .all()
})
