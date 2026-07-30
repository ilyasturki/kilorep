import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { sql } from 'drizzle-orm';

import type { Database } from './client.ts';
import { migrationsFolder } from './config.ts';

/**
 * Applied at boot from `hooks.server.ts`, not by a separate command: a
 * self-hoster pulls a new image, runs it, and the database is correct. The
 * upgrade step that must be remembered is the one that gets skipped.
 *
 * Foreign keys are off for the duration, and that is not a convenience.
 *
 * SQLite cannot alter a column, so drizzle-kit emits the standard rebuild for
 * any change to one: create a new table, copy the rows, `DROP TABLE` the old,
 * rename. Every such migration therefore drops `users` — and `auth_tokens` and
 * `sync_counters` both reference it `on delete cascade`, so with enforcement on,
 * the implicit delete inside `DROP TABLE` takes every credential and every sync
 * counter with it. Silently: the migration reports success, everyone is signed
 * out, and each account's `seq` restarts at 1 while its devices hold watermarks
 * far ahead of it — so a pull returns nothing and never recovers.
 *
 * drizzle-kit knows this and writes `PRAGMA foreign_keys=OFF` into the migration
 * itself. It cannot work there: the migrator runs each file in a transaction,
 * and that pragma is a documented no-op inside one. Issued here it is outside
 * any transaction and takes effect, which is also what the procedure in SQLite's
 * own ALTER TABLE documentation prescribes.
 *
 * `foreign_key_check` afterwards is the other half of that procedure, and the
 * reason turning enforcement off is safe rather than merely quiet: a migration
 * that leaves an orphan behind fails loudly here instead of years later.
 */
export function runMigrations(db: Database, folder: string = migrationsFolder): void {
	const sqlite = db.$client;

	sqlite.exec('pragma foreign_keys = off');
	try {
		migrate(db, { migrationsFolder: folder });
	} finally {
		// Restored even when a migration throws — the connection is the one the
		// server goes on to serve requests with, and `client.ts` turned this on for
		// reasons that outlive the migration.
		sqlite.exec('pragma foreign_keys = on');
	}

	const violations = sqlite.prepare('pragma foreign_key_check').all();
	if (violations.length > 0) {
		throw new Error(
			`migrations left ${violations.length} foreign key violation(s) behind; the database is not safe to serve`
		);
	}
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
