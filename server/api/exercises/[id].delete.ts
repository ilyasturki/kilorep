// The handler is synchronous, so the usage counted here is the usage that made
// the delete fail — at least one count is always nonzero.
function usageMessage({
    sessions,
    workouts,
}: {
    sessions: number
    workouts: number
}): string {
    const parts = [
        ...(sessions > 0 ? [plural(sessions, 'template')] : []),
        ...(workouts > 0 ? [plural(workouts, 'workout')] : []),
    ]
    return `This exercise is used in ${parts.join(' and ')} and can't be deleted`
}

defineRouteMeta({
    openAPI: {
        operationId: 'deleteExercise',
        tags: ['exercises'],
        summary: 'Delete an unused catalog exercise',
        parameters: [
            {
                name: 'id',
                in: 'path',
                required: true,
                description: 'The exercise id',
                schema: {
                    type: 'integer',
                },
            },
        ],
        responses: {
            '200': {
                description: 'The deleted exercise.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/Exercise',
                        },
                    },
                },
            },
            '404': {
                description: 'Exercise not found.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ApiError',
                        },
                    },
                },
            },
            '409': {
                description:
                    'Still referenced by templates or workouts; data.usage carries ExerciseUsage counts for the merge flow.',
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
    const id = getIdParam(event, 'exercise')

    let deleted
    try {
        // session_exercises references this row without a cascade, so SQLite
        // refuses the delete while any session still uses the exercise.
        deleted = useDrizzle()
            .delete(tables.exercises)
            .where(
                and(
                    eq(tables.exercises.id, id),
                    eq(tables.exercises.userId, userId),
                ),
            )
            .returning()
            .get()
    } catch (error) {
        if (error instanceof Error && error.message.includes('FOREIGN KEY')) {
            // The structured payload lets the client tell "in use" apart from
            // other conflicts and hand over to the merge flow.
            const usage = countExerciseUsage(id)
            conflict(usageMessage(usage), { usage })
        }
        throw error
    }

    if (!deleted) {
        notFound('Exercise not found')
    }
    return deleted
})
