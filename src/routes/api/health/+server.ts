import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';

import { getDatabase } from '$lib/server/db/client';
import { appliedMigrationCount } from '$lib/server/db/migrate';

import type { RequestHandler } from './$types';

/**
 * Liveness plus schema state, for the container healthcheck and for confirming
 * a deploy without shell access to the volume.
 *
 * Unauthenticated, so it says as little as it can get away with: no database
 * path (that is the host's filesystem layout) and no error text (that is the
 * internals). The detail goes to the server log, where the operator is.
 *
 * Clients must reach this through the configured `apiBase`, never as a bare
 * relative `/api/health` — inside the APK the origin is `capacitor://localhost`
 * and this endpoint was omitted from the static build (CLAUDE.md hard rule 4).
 */
export const GET: RequestHandler = () => {
	try {
		const db = getDatabase();
		db.get(sql`select 1`);

		return json({
			ok: true,
			database: { reachable: true },
			migrations: { applied: appliedMigrationCount(db) }
		});
	} catch (error) {
		console.error('health check failed:', error);

		return json({ ok: false, database: { reachable: false } }, { status: 503 });
	}
};
