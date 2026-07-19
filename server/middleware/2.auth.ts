/**
 * Resolves which account every data request operates as, exposing it as
 * `event.context.userId` for `requireUserId`. Without auth configured the
 * app is single-user: everything belongs to the implicit local user. With
 * auth on, a bearer token or the sealed session cookie names the account
 * and anything else is a 401.
 */
export default defineEventHandler(async (event) => {
    const path = event.path.split('?')[0]!
    if (!path.startsWith('/api/') && path !== '/mcp') return
    // nuxt-auth-utils' own session endpoint must stay reachable to establish
    // and clear sessions. The public auth routes are an exact allowlist (the
    // mode probe and device sign-in are all a credential-less client needs);
    // any future /api/auth/ route fails closed instead of inheriting the
    // exemption.
    if (path.startsWith('/api/_auth/')) return
    if (path === '/api/auth/mode' || path === '/api/auth/device') return
    // Deploy probe: it exposes only the version and commit, and has to answer
    // without credentials to be useful. Exact path, like the two above.
    if (path === '/api/_version') return

    if (!authEnabled()) {
        event.context.userId = ensureLocalUserId()
        return
    }

    // Clients that can't hold a Google session — MCP and the native app —
    // authenticate any route with a bearer token (minted on the settings
    // page or at device sign-in).
    const header = getHeader(event, 'authorization')
    if (header?.startsWith('Bearer ')) {
        const userId = findUserIdByApiToken(
            header.slice('Bearer '.length).trim(),
        )
        if (userId == null) {
            unauthorized('Invalid token')
        }
        event.context.authMethod = 'token'
        // A stolen token must stay containable by revoking that one token:
        // letting it reach token management would let it mint siblings that
        // survive its own revocation, or delete the account outright. Prefix
        // check so any future /api/account route fails closed.
        if (path.startsWith('/api/account')) {
            forbidden('Bearer tokens cannot manage the account or tokens')
        }
        event.context.userId = userId
        return
    }

    const session = await getUserSession(event)
    // A sealed cookie can outlive its account (deletion has no way to recall
    // copies), so confirm the row still exists before trusting it.
    if (!session.user || !userExists(session.user.id)) {
        await clearUserSession(event)
        unauthorized('Unauthorized')
    }
    event.context.userId = session.user.id
})
