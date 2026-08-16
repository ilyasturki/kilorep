import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';

import type { WireRecord } from '$lib/sync/protocol';

export type StoredRecord = WireRecord & { dirty: boolean };

export type KilorepSchema = DBSchema & {
	records: {
		key: string;
		value: StoredRecord;
		indexes: { kind: string };
	};
	meta: {
		key: string;
		value: unknown;
	};
};

export type KilorepDatabase = IDBPDatabase<KilorepSchema>;

export const DATABASE_NAME = 'kilorep';

export async function openDatabase(name: string = DATABASE_NAME): Promise<KilorepDatabase> {
	const db = await openDB<KilorepSchema>(name, 1, {
		upgrade(database, oldVersion) {
			if (oldVersion < 1) {
				const records = database.createObjectStore('records', { keyPath: 'id' });
				records.createIndex('kind', 'kind');
				database.createObjectStore('meta');
			}
		}
	});

	return db;
}
