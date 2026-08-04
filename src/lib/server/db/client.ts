import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { NodeSQLiteDatabase } from 'drizzle-orm/node-sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';

import { databasePath } from './config.ts';

/**
 * `node:sqlite` is a Node builtin, so the server carries no compiled dependency
 * and the container has nothing to build. It is unavailable under Bun (1.3.13
 * reports "No such built-in module"), which is why the tests run on vitest
 * rather than `bun test`.
 */

export type Database = NodeSQLiteDatabase & { $client: DatabaseSync };

export function createDatabase(file: string = databasePath): Database {
	if (file !== ':memory:') {
		mkdirSync(path.dirname(file), { recursive: true });
	}

	const sqlite = new DatabaseSync(file);

	sqlite.exec('pragma foreign_keys = on');

	if (file !== ':memory:') {
		sqlite.exec('pragma journal_mode = wal');
		sqlite.exec('pragma synchronous = normal');
		sqlite.exec('pragma busy_timeout = 5000');
	}

	// No `schema` option: drizzle 1.0 omits it from the SQLite config in favour
	// of `relations`, which only the relational query API needs. Plain
	// select/insert take their types from the table objects themselves.
	return drizzle({ client: sqlite });
}

let instance: Database | undefined;

export function getDatabase(): Database {
	return (instance ??= createDatabase());
}

// Dev only. Editing any server file re-evaluates this module, and without a
// dispose the previous `DatabaseSync` — plus its WAL and shm handles — is
// simply abandoned, one leak per save. `import.meta.hot` is undefined in both
// builds, so this costs production nothing.
if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		if (instance) {
			instance.$client.close();
			instance = undefined;
		}
	});
}
