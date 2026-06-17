import type { WorkoutTemplateStatus } from '~~/server/database/schema'

/**
 * Saves a workout's structure back to a session template. `update` rewrites
 * the source template in place; `create` makes a new template and re-points
 * the workout at it, so the divergence offer clears and later edits diff
 * against the template actually followed. Both modes keep the old template's
 * prescribed reps for sets that still match (see `workoutToSessionEntries`).
 */
defineRouteMeta({
    openAPI: {
        operationId: 'workoutToSession',
        tags: ['workouts'],
        summary:
            "Save a diverged workout's structure back to a session template",
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
                        $ref: '#/components/schemas/ToSessionInput',
                    },
                },
            },
        },
        responses: {
            '200': {
                description:
                    'The template now backing the workout; diverged is always false.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/TemplateStatus',
                        },
                    },
                },
            },
            '400': {
                description:
                    'Invalid mode, missing name, or no exercises to save.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ApiError',
                        },
                    },
                },
            },
            '404': {
                description:
                    'Workout (or, for update mode, its template) not found.',
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

export default defineEventHandler(
    async (event): Promise<WorkoutTemplateStatus> => {
        const userId = requireUserId(event)
        const id = getIdParam(event, 'workout')
        const body = await readBody<{ mode?: string; name?: string }>(event)
        const mode = body?.mode
        if (mode !== 'update' && mode !== 'create') {
            badRequest('"mode" must be "update" or "create"')
        }

        const workout = loadWorkoutTrees(userId, [id])[0]
        if (!workout) {
            notFound('Workout not found')
        }
        if (!workout.entries.some((entry) => entry.exercises.length > 0)) {
            badRequest('The workout has no exercises to save')
        }

        const source =
            workout.sessionId != null ?
                loadSessionTrees(userId, [workout.sessionId])[0]
            :   undefined

        if (mode === 'update') {
            if (!source) {
                notFound('This workout has no template to update')
            }
            const updated = replaceSessionTree(userId, source.id, {
                name: source.name,
                entries: workoutToSessionEntries(
                    workout.entries,
                    source.entries,
                ),
            })
            return {
                id: updated.id,
                name: updated.name,
                diverged: false,
                changes: [],
            }
        }

        const name = body?.name?.trim()
        if (!name) {
            badRequest('A session "name" is required')
        }
        const entries = workoutToSessionEntries(
            workout.entries,
            source?.entries,
        )
        const created = useDrizzle().transaction((tx) => {
            const session = createSessionTree(userId, { name, entries }, tx)
            // The workout is now an instance of the new template, so it takes
            // its identity: name snapshot included, not just the pointer.
            tx.update(tables.workouts)
                .set({ sessionId: session.id, name: session.name })
                .where(eq(tables.workouts.id, workout.id))
                .run()
            return session
        })
        return {
            id: created.id,
            name: created.name,
            diverged: false,
            changes: [],
        }
    },
)
