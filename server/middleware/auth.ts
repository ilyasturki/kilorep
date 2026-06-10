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

    const session = await getUserSession(event)
    if (!session.user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
    event.context.userId = session.user.id
})
