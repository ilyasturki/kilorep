import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

import { DB_FILE_NAME } from '../utils/drizzle'

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

    // Migrations get their own connection with foreign_keys OFF: the migrator
    // wraps all pending migrations in one transaction, where `PRAGMA
    // foreign_keys` is a no-op, so table-recreation migrations would trip
    // enforcement mid-rebuild on the app connection. Integrity is instead
    // checked explicitly once migrations have applied, per SQLite's
    // documented recreate procedure.
    mkdirSync(dirname(DB_FILE_NAME), { recursive: true })
    const sqlite = new Database(DB_FILE_NAME)
    sqlite.pragma('foreign_keys = OFF')
    try {
        migrate(drizzle(sqlite), { migrationsFolder })
        const violations = sqlite.pragma('foreign_key_check')
        if (Array.isArray(violations) && violations.length > 0) {
            throw new Error(
                `migration left ${violations.length} foreign key violation(s): `
                    + JSON.stringify(violations.slice(0, 5)),
            )
        }
    } catch (error) {
        // Fail fast: a broken schema must stop startup, not surface later as
        // confusing per-request "no such table" errors.
        console.error('[drizzle] failed to apply migrations', error)
        throw error
    } finally {
        sqlite.close()
    }
})
