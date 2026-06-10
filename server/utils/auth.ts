import type { H3Event } from 'h3'

declare module 'h3' {
    interface H3EventContext {
        userId?: number
    }
}

/**
 * The account this request operates as, resolved by the auth middleware.
 * Every data query must be scoped by this id — handlers take it as a required
 * parameter so an unscoped call can't typecheck.
 */
export function requireUserId(event: H3Event): number {
    const { userId } = event.context
    if (userId == null) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
    return userId
}
