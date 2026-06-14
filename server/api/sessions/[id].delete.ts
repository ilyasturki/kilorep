defineRouteMeta({
    openAPI: {
        operationId: 'deleteSession',
        tags: ['sessions'],
        summary: 'Delete a session template',
        description:
            'Workouts started from it keep their copied trees; their sessionId is nulled.',
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
        responses: {
            '200': {
                description: 'The deleted session row.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/Session',
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

export default defineEventHandler((event) => {
    const userId = requireUserId(event)
    const id = getIdParam(event, 'session')

    // Entries, exercises and sets cascade away via their foreign keys.
    const deleted = useDrizzle()
        .delete(tables.sessions)
        .where(
            and(eq(tables.sessions.id, id), eq(tables.sessions.userId, userId)),
        )
        .returning()
        .get()
    if (!deleted) {
        notFound('Session not found')
    }
    return deleted
})
