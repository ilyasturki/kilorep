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

    const db = useDrizzle()
    const current = db
        .select()
        .from(tables.exercises)
        .where(
            and(
                eq(tables.exercises.id, id),
                eq(tables.exercises.userId, userId),
            ),
        )
        .get()
    if (!current) {
        notFound('Exercise not found')
    }

    // The load mode is the user's logging convention, not a different
    // movement — correcting it alone must not brand a catalog entry custom.
    // Only a change to what the movement *is* reclassifies it.
    const rebranded =
        values.name !== current.name
        || values.equipment !== current.equipment
        || values.type !== current.type
        || JSON.stringify(values.muscles) !== JSON.stringify(current.muscles)

    let updated
    try {
        updated = db
            .update(tables.exercises)
            .set({
                ...values,
                loadMode: values.loadMode ?? current.loadMode,
                source: rebranded ? 'custom' : current.source,
            })
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
