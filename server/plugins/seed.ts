import { EXERCISE_CATALOG } from '../database/exercise-catalog'

const CATALOG_CURSOR_KEY = 'catalogCursor'

/**
 * Seeds the default exercise catalog after migrations have run (Nitro
 * registers plugins alphabetically, and "migrate" sorts before "seed").
 *
 * The catalog is applied once, not re-synced on every startup: a cursor in
 * `meta` records how many entries this database has been offered, and only
 * entries appended past it are inserted. Deleting a default exercise therefore
 * sticks — earlier versions re-inserted the whole catalog by name on each
 * launch, resurrecting deleted defaults. This only works while
 * EXERCISE_CATALOG stays append-only (see its doc comment).
 */
export default defineNitroPlugin(() => {
    if (import.meta.prerender) return

    try {
        useDrizzle().transaction((tx) => {
            const row = tx
                .select()
                .from(tables.meta)
                .where(eq(tables.meta.key, CATALOG_CURSOR_KEY))
                .get()
            const cursor = row ? Math.max(0, Number(row.value) || 0) : null

            if (cursor !== null && cursor >= EXERCISE_CATALOG.length) return

            // Databases from before the cursor existed were re-seeded in full
            // on every startup, so every entry has already been offered —
            // including any the user has since deleted. Record the cursor
            // without inserting anything.
            const isLegacyDb =
                cursor === null
                && tx
                    .select({ id: tables.exercises.id })
                    .from(tables.exercises)
                    .limit(1)
                    .get() !== undefined

            const fresh = isLegacyDb ? [] : EXERCISE_CATALOG.slice(cursor ?? 0)
            if (fresh.length > 0) {
                // A user-created exercise may share a name with a catalog
                // entry appended later; the user's version wins.
                tx.insert(tables.exercises)
                    .values(fresh)
                    .onConflictDoNothing({ target: tables.exercises.name })
                    .run()
            }

            const value = String(EXERCISE_CATALOG.length)
            tx.insert(tables.meta)
                .values({ key: CATALOG_CURSOR_KEY, value })
                .onConflictDoUpdate({
                    target: tables.meta.key,
                    set: { value },
                })
                .run()
        })
    } catch (error) {
        console.error('[seed] failed to seed exercise catalog', error)
        throw error
    }
})
