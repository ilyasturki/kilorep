import path from 'node:path';

import { envText } from '../env.ts';

/**
 * Where the database lives. Separate from `../config.ts` — which holds the
 * settings the HTTP surface reads — because `drizzle.config.ts` imports this
 * module and must not drag the server's request-time configuration along with
 * it.
 */

/** The SQLite file. One per instance; `:memory:` is honoured, for tests. */
export const databasePath = envText('DATABASE_PATH', '.data/kilorep.db');

/**
 * Where the generated SQL migrations live, resolved against the working
 * directory. Top-level rather than under `src/` so the container can copy the
 * folder as-is — the migrator reads it from disk at boot, so it must ship.
 */
export const migrationsFolder = path.resolve(envText('MIGRATIONS_DIR', 'drizzle'));
