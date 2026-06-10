/**
 * Seeds the default exercise catalog after migrations have run (Nitro
 * registers plugins alphabetically, and "migrate" sorts before "seed").
 *
 * The catalog is per user: each account keeps its own copy, seeded at signup
 * and topped up here at boot when entries were appended since (each user's
 * `catalogCursor` records how many entries they have been offered — see
 * syncUserCatalog). This only works while EXERCISE_CATALOG stays append-only
 * (see its doc comment). Databases from before the cursor existed are handled
 * by migration 0008, which records the then-current catalog as fully offered.
 */
export default defineNitroPlugin(() => {
    if (import.meta.prerender) return

    try {
        // The implicit single-user account only exists when auth is off; a
        // multi-user instance creates accounts at first sign-in instead.
        if (!authEnabled()) ensureLocalUserId()
        const users = useDrizzle()
            .select({
                id: tables.users.id,
                catalogCursor: tables.users.catalogCursor,
            })
            .from(tables.users)
            .all()
        for (const user of users) {
            syncUserCatalog(user.id, user.catalogCursor)
        }
    } catch (error) {
        console.error('[seed] failed to seed exercise catalog', error)
        throw error
    }
})
