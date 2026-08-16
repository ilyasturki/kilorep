import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { NodeSQLiteDatabase } from 'drizzle-orm/node-sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';

import { databasePath } from './config.ts';

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

	return drizzle({ client: sqlite });
}

let instance: Database | undefined;

export function getDatabase(): Database {
	return (instance ??= createDatabase());
}

if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		if (instance) {
			instance.$client.close();
			instance = undefined;
		}
	});
}
