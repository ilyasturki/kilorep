import type { DashboardData } from '~~/server/database/schema'

defineRouteMeta({
    openAPI: {
        operationId: 'getDashboard',
        tags: ['dashboard'],
        summary: 'Pre-computed training overview for the dashboard page',
        responses: {
            '200': {
                description:
                    'Last-7-day summary with week-over-week deltas, an 8-week volume trend, a 30-day bodyweight window, top muscles, recent workouts and estimated-1RM PRs.',
                content: {
                    'application/json': {
                        schema: { type: 'object' },
                    },
                },
            },
        },
    },
})

export default defineEventHandler((event): DashboardData => {
    const userId = requireUserId(event)
    return loadDashboard(userId)
})
