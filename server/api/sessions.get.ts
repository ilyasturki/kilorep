import type { SessionWithEntries } from '~~/server/database/schema'
import { loadSessionTrees } from '~~/server/utils/sessions'

defineRouteMeta({
    openAPI: {
        operationId: 'listSessions',
        tags: ['sessions'],
        summary: 'List all session templates as full trees, in manual order',
        responses: {
            '200': {
                description:
                    'Every session with its entries, exercises and prescribed sets.',
                content: {
                    'application/json': {
                        schema: {
                            type: 'array',
                            items: {
                                $ref: '#/components/schemas/SessionWithEntries',
                            },
                        },
                    },
                },
            },
        },
    },
})

export default defineEventHandler((event): SessionWithEntries[] =>
    loadSessionTrees(requireUserId(event)),
)
