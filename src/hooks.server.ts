import { building } from '$app/environment';

import { getDatabase } from '$lib/server/db/client';
import { runMigrations } from '$lib/server/db/migrate';
import { createHandle } from '$lib/server/http/handle';

// The build imports this module too: without the guard, compiling the Capacitor
// bundle opens and migrates the build machine's `DATABASE_PATH`.
if (!building) {
	runMigrations(getDatabase());
}

export const handle = createHandle(getDatabase);
