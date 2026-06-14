defineRouteMeta({
    openAPI: {
        operationId: 'deleteBodyweight',
        tags: ['bodyweight'],
        summary: 'Delete a weigh-in',
        parameters: [
            {
                name: 'id',
                in: 'path',
                required: true,
                description: 'The weigh-in id',
                schema: {
                    type: 'integer',
                },
            },
        ],
        responses: {
            '200': {
                description: 'The deleted weigh-in.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/Bodyweight',
                        },
                    },
                },
            },
            '404': {
                description: 'Weigh-in not found.',
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
    const userId = requireUserId(event)
    const id = getIdParam(event, 'weigh-in')

    const deleted = useDrizzle()
        .delete(tables.bodyweight)
        .where(
            and(
                eq(tables.bodyweight.id, id),
                eq(tables.bodyweight.userId, userId),
            ),
        )
        .returning()
        .get()

    if (!deleted) {
        notFound('Weigh-in not found')
    }
    return deleted
})
