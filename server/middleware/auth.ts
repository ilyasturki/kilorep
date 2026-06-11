/**
 * Resolves which account every data request operates as, exposing it as
 * `event.context.userId` for `requireUserId`. Without auth configured the
 * app is single-user: everything belongs to the implicit local user. With
 * auth on, the sealed session cookie names the account and anything else
 * is a 401.
 */
export default defineEventHandler(async (event) => {
    const path = event.path.split('?')[0]!
    if (!path.startsWith('/api/') && path !== '/mcp') return
    // nuxt-auth-utils' own session endpoint must stay reachable to establish
    // and clear sessions, and the mode probe is what tells a logged-out
    // client that it must log in at all.
    if (path.startsWith('/api/_auth/') || path === '/api/auth/mode') return

    if (!authEnabled()) {
        event.context.userId = ensureLocalUserId()
        return
    }

    // MCP clients can't hold a Google session; /mcp (and only /mcp) also
    // accepts a bearer token minted on the settings page.
    if (path === '/mcp') {
        const header = getHeader(event, 'authorization')
        if (header?.startsWith('Bearer ')) {
            const userId = findUserIdByApiToken(
                header.slice('Bearer '.length).trim(),
            )
            if (userId == null) {
                unauthorized('Invalid token')
            }
            event.context.userId = userId
            return
        }
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
