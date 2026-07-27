import path from 'node:path';

/**
 * Read in plain `process.env` rather than `$env/dynamic/private` on purpose:
 * `drizzle.config.ts` and `scripts/seed.ts` run outside SvelteKit entirely,
 * and they must resolve the same database as the server does.
 *
 * Which is also why `.env` is loaded here, in the one module all of them
 * import. `drizzle-kit` reads `.env` on its own and nothing else does, so
 * without this `bun run db:migrate` would happily migrate a file the server
 * never opens. A real environment variable wins — `loadEnvFile` fills gaps
 * rather than overwriting — so a container is unaffected.
 */
try {
	process.loadEnvFile('.env');
} catch {
	// No `.env`; the defaults below stand. This is the normal case in production.
}

/** The SQLite file. One per instance; `:memory:` is honoured, for tests. */
export const databasePath = process.env.DATABASE_PATH ?? '.data/kilorep.db';

/**
 * Where the generated SQL migrations live, resolved against the working
 * directory. Top-level rather than under `src/` so the container can copy the
 * folder as-is — the migrator reads it from disk at boot, so it must ship.
 */
export const migrationsFolder = path.resolve(process.env.MIGRATIONS_DIR ?? 'drizzle');
