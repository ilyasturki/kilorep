import type { WorkoutWithEntries } from '~~/server/database/schema'

defineRouteMeta({
    openAPI: {
        operationId: 'listWorkouts',
        tags: ['workouts'],
        summary: 'List all workouts as full trees, newest first',
        responses: {
            '200': {
                description:
                    'Every workout with its entries, exercises and logged sets.',
                content: {
                    'application/json': {
                        schema: {
                            type: 'array',
                            items: {
                                $ref: '#/components/schemas/WorkoutWithEntries',
                            },
                        },
                    },
                },
            },
        },
    },
})

export default defineEventHandler((event): WorkoutWithEntries[] => {
    const userId = requireUserId(event)

    const ids = useDrizzle()
        .select({ id: tables.workouts.id })
        .from(tables.workouts)
        .where(eq(tables.workouts.userId, userId))
        .all()
        .map((row) => row.id)
    return loadWorkoutTrees(userId, ids)
})
