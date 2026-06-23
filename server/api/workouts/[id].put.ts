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

    const updated = saveWorkout(userId, id, parsed)

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
