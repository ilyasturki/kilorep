import type { ExerciseDetail } from '~~/server/database/schema'

defineRouteMeta({
    openAPI: {
        operationId: 'getExercise',
        tags: ['exercises'],
        summary: 'Read an exercise with its sessions, history and best set',
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
                description: 'The enriched exercise.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ExerciseDetail',
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
        },
    },
})

export default defineEventHandler((event): ExerciseDetail => {
    const userId = requireUserId(event)
    const id = getIdParam(event, 'exercise')
    return getExerciseDetail(id, userId)
})
