import type { H3Event } from 'h3'

declare module 'h3' {
    interface H3EventContext {
        userId?: number
        /** Set when auth came from a bearer token rather than the session cookie. */
        authMethod?: 'token'
    }
}

/**
 * Multi-user mode is on iff Google OAuth credentials are configured
 * (NUXT_OAUTH_GOOGLE_CLIENT_ID / _CLIENT_SECRET). Without them the app runs
 * single-user as the implicit local account — there is no separate flag.
 */
export function authEnabled(): boolean {
    const { oauth } = useRuntimeConfig()
    return Boolean(oauth?.google?.clientId && oauth?.google?.clientSecret)
}

/**
 * 404s endpoints that only exist in auth mode (OAuth, token minting, account
 * deletion), so a single-user instance doesn't even reveal they exist.
 */
export function requireAuthMode(): void {
    if (!authEnabled()) {
        notFound('Not Found')
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
        unauthorized('Unauthorized')
    }
    return userId
}
