defineRouteMeta({
    openAPI: {
        operationId: 'listExercises',
        tags: ['exercises'],
        summary: "List the user's exercise catalog",
        responses: {
            '200': {
                description: 'Every catalog exercise.',
                content: {
                    'application/json': {
                        schema: {
                            type: 'array',
                            items: {
                                $ref: '#/components/schemas/Exercise',
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
        .from(tables.exercises)
        .where(eq(tables.exercises.userId, userId))
        .orderBy(asc(tables.exercises.id))
        .all()
})
