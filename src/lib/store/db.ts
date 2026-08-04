/**
 * The device database: IndexedDB, opened through `idb`'s typed promise
 * wrapper. This module owns the schema — names, key paths, indexes, the
 * version — and hands back a connection; what the records mean is `store.ts`'s
 * business.
 *
 * IndexedDB and not SQLite or localStorage, decided once: it is the one
 * storage that behaves identically in the browser and the Capacitor WebView,
 * needs no native plugin, and holds structured records at a size localStorage
 * cannot. Plain TypeScript per CLAUDE.md hard rule 1 — `idb` is a wrapper over
 * a web standard, not a framework.
 */

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
