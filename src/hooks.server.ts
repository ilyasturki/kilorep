import { building } from '$app/environment';

import { getDatabase } from '$lib/server/db/client';
import { runMigrations } from '$lib/server/db/migrate';

/**
 * Module scope runs once, when the server starts — dev and production alike.
 * Migrating here is what makes the self-hosting story a single `docker run`:
 * pull a new image, start it, the schema is correct.
 *
 * Not while `building`, though. The build imports this module too, so without
 * the guard `bun run build:app` — the Capacitor bundle, which has no server at
 * all — opens a database file and migrates it as a side effect of compiling,
 * against `DATABASE_PATH` as it happens to be set on the build machine.
 *
 * This file exists only in the `adapter-node` build. The Capacitor bundle is
 * built with `adapter-static`, which omits server files entirely — which is
 * also why nothing here may ever be imported by client code.
 */
if (!building) {
	runMigrations(getDatabase());
}
