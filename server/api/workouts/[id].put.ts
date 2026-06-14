defineRouteMeta({
    openAPI: {
        operationId: 'saveWorkout',
        tags: ['workouts'],
        summary: 'Replace a workout: row fields plus the whole logged tree',
        description:
            'The tree is replaced, not diffed — the simplest correct way to persist arbitrary add/remove/reorder edits. Sync replays whole workouts through here (last writer wins).',
        parameters: [
            {
                name: 'id',
                in: 'path',
                required: true,
                description: 'The workout id',
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
                        $ref: '#/components/schemas/WorkoutInput',
                    },
                },
            },
        },
        responses: {
            '200': {
                description:
                    'The updated row with template status recomputed against the just-persisted tree.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/WorkoutSaveResult',
                        },
                    },
                },
            },
            '400': {
                description:
                    'No usable exercise/set, or an unknown exercise id.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ApiError',
                        },
                    },
                },
            },
            '404': {
                description: 'Workout not found.',
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
    const id = getIdParam(event, 'workout')
    const parsed = parseWorkoutInput(await readBody<WorkoutInput>(event))

    const updated = useDrizzle().transaction((tx) => {
        const existing = tx
            .select()
            .from(tables.workouts)
            .where(
                and(
                    eq(tables.workouts.id, id),
                    eq(tables.workouts.userId, userId),
                ),
            )
            .get()
        if (!existing) {
            notFound('Workout not found')
        }

        const row = tx
            .update(tables.workouts)
            .set({
                ...(parsed.name ? { name: parsed.name } : {}),
                startedAt: parsed.startedAt ?? existing.startedAt,
                completed: parsed.completed,
            })
            .where(eq(tables.workouts.id, id))
            .returning()
            .get()

        // Replace the whole tree rather than diffing: the simplest correct way
        // to persist arbitrary add/remove/reorder edits. Deleting the entries
        // cascades to their exercises and sets.
        tx.delete(tables.workoutEntries)
            .where(eq(tables.workoutEntries.workoutId, id))
            .run()
        writeWorkoutEntries(tx, userId, id, parsed.entries)

        return row
    })

    return {
        ...updated,
        // Recomputed on every save so the client's sync-back strip tracks the
        // just-persisted tree without a follow-up read.
        template: workoutTemplateStatus(
            userId,
            updated.sessionId,
            parsed.entries,
        ),
    }
})
