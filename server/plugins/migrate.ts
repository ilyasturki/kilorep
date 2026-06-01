import { resolve } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

/**
 * Applies pending Drizzle migrations on server startup, in every runtime
 * environment, using the `drizzle-orm` runtime migrator — `drizzle-kit` is a
 * devDependency and is only needed to *generate* migrations, never to apply
 * them, so production never depends on it.
 *
 * The migrations ship in the source tree at `server/database/migrations` and
 * must be present at runtime. Override the location with `DB_MIGRATIONS_DIR`
 * when the server is launched from a different working directory.
 */
export default defineNitroPlugin(() => {
    // Don't touch the database while prerendering at build time.
    if (import.meta.prerender) return

    const migrationsFolder =
        process.env.DB_MIGRATIONS_DIR
        ?? resolve(process.cwd(), 'server/database/migrations')

    try {
        migrate(useDrizzle(), { migrationsFolder })
    } catch (error) {
        // Fail fast: a broken schema must stop startup, not surface later as
        // confusing per-request "no such table" errors.
        console.error('[drizzle] failed to apply migrations', error)
        throw error
    }
})
