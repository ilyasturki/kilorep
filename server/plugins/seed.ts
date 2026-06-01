import { EXERCISE_CATALOG } from '../database/exercise-catalog'

/**
 * Seeds the default exercise catalog after migrations have run.
 *
 * Runs after `migrate.ts` (Nitro registers plugins in alphabetical order, and
 * "migrate" sorts before "seed"). Insertion is idempotent: `exercises.name` is
 * unique and conflicts are ignored, so existing rows are left untouched and
 * only newly-added catalog entries are inserted on later startups.
 */
export default defineNitroPlugin(() => {
    if (import.meta.prerender) return

    try {
        useDrizzle()
            .insert(tables.exercises)
            .values(EXERCISE_CATALOG)
            .onConflictDoNothing({ target: tables.exercises.name })
            .run()
    } catch (error) {
        console.error('[seed] failed to seed exercise catalog', error)
        throw error
    }
})
