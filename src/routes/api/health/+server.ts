import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';

import { getDatabase } from '$lib/server/db/client';
import { appliedMigrationCount } from '$lib/server/db/migrate';

import type { RequestHandler } from './$types';

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
