import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { sql } from 'drizzle-orm';

import type { Database } from './client.ts';
import { migrationsFolder } from './config.ts';

/**
 * Applied at boot from `hooks.server.ts`, not by a separate command: a
 * self-hoster pulls a new image, runs it, and the database is correct. The
 * upgrade step that must be remembered is the one that gets skipped.
 */
export function runMigrations(db: Database, folder: string = migrationsFolder): void {
	migrate(db, { migrationsFolder: folder });
}

/**
 * How many migrations the database has applied. Surfaced by `/api/health` so a
 * deploy can be checked for schema drift without shell access to the volume.
 */
export function appliedMigrationCount(db: Database): number {
	// A database that has never been migrated has no bookkeeping table, and
	// selecting from it raises `no such table`. Zero is the honest answer; the
	// throw would reach `/api/health` and be reported as an unreachable
	// database, which is the one thing it is not.
	const table = db.get<{ name: string }>(
		sql`select name from sqlite_master where type = 'table' and name = '__drizzle_migrations'`
	);
	if (table === undefined) {
		return 0;
	}

	const row = db.get<{ count: number }>(
		sql`select count(*) as count from ${sql.identifier('__drizzle_migrations')}`
	);
	return row === undefined ? 0 : row.count;
}
