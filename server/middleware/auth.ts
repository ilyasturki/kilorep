/**
 * Resolves which account every data request operates as, exposing it as
 * `event.context.userId` for `requireUserId`. Without auth configured the
 * app is single-user: everything belongs to the implicit local user. The
 * Google-auth branch lands with the login flow.
 */
export default defineEventHandler((event) => {
    const path = event.path.split('?')[0]!
    if (!path.startsWith('/api/') && path !== '/mcp') return

    event.context.userId = ensureLocalUserId()
})
