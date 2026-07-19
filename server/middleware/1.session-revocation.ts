/**
 * The server-side enforcement point for "sign out my other browsers". Sessions
 * are stateless sealed cookies, so nothing downstream can know one was revoked;
 * we reject here instead. Any session issued before the user's
 * `sessionsRevokedAt` cut-off is dead.
 *
 * Runs before 2.auth so a revoked cookie never resolves to a userId. Scoped to
 * /api/** because that is the whole authenticated surface, and it also covers
 * nuxt-auth-utils' own GET /api/_auth/session — so a revoked browser sees
 * loggedIn=false and the route guard bounces it to /login.
 *
 * Bearer tokens are untouched: they carry no session, and each one is already
 * revocable on its own row from settings.
 */
export default defineEventHandler(async (event) => {
    if (!event.path.startsWith('/api/')) return
    // A single-user instance has no sessions to revoke, and no session password
    // to unseal a cookie with — getUserSession would throw on every request.
    if (!authEnabled()) return
    if (getHeader(event, 'authorization')?.startsWith('Bearer ')) return

    const session = await getUserSession(event)
    const userId = session.user?.id
    if (userId == null) return

    const revokedAt = useDrizzle()
        .select({ sessionsRevokedAt: tables.users.sessionsRevokedAt })
        .from(tables.users)
        .where(eq(tables.users.id, userId))
        .get()?.sessionsRevokedAt
    if (!revokedAt) return

    // Both sides are new Date().toISOString() (fixed-width UTC), so plain string
    // ordering is correct. A session at or after the cut-off survives; a missing
    // loggedInAt sorts before any real timestamp, so it is rejected.
    if ((session.loggedInAt ?? '') >= revokedAt) return

    await clearUserSession(event)
    unauthorized('Session revoked')
})
