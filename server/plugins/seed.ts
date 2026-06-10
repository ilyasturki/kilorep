import { EXERCISE_CATALOG } from '../database/exercise-catalog'

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
        ensureLocalUserId()
        const users = useDrizzle()
            .select({
                id: tables.users.id,
                catalogCursor: tables.users.catalogCursor,
            })
            .from(tables.users)
            .all()
        for (const user of users) {
            if (user.catalogCursor < EXERCISE_CATALOG.length) {
                syncUserCatalog(user.id, user.catalogCursor)
            }
        }
    } catch (error) {
        console.error('[seed] failed to seed exercise catalog', error)
        throw error
    }
})
