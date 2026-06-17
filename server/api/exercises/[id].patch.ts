defineRouteMeta({
    openAPI: {
        operationId: 'updateExercise',
        tags: ['exercises'],
        summary: 'Update a catalog exercise',
        description: 'Aliases are not editable here; they accrue via merges.',
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
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        $ref: '#/components/schemas/ExerciseInput',
                    },
                },
            },
        },
        responses: {
            '200': {
                description: 'The updated exercise.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/Exercise',
                        },
                    },
                },
            },
            '400': {
                description: 'Malformed name, equipment, type or muscles.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ApiError',
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
                description: 'An exercise with that name already exists.',
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
    const id = getIdParam(event, 'exercise')
    const body = (await readBody<Record<string, unknown>>(event)) ?? {}
    const values = parseExerciseInput(body)

    let updated
    try {
        updated = useDrizzle()
            .update(tables.exercises)
            .set({ ...values, source: 'custom' })
            .where(
                and(
                    eq(tables.exercises.id, id),
                    eq(tables.exercises.userId, userId),
                ),
            )
            .returning()
            .get()
    } catch (error) {
        asDuplicateNameError(error)
    }

    if (!updated) {
        notFound('Exercise not found')
    }
    return updated
})
