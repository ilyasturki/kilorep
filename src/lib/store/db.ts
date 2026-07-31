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

/**
 * A synced record at rest on the device: the wire shape plus the one local
 * fact the server must never see — whether it still owes a push. `dirty` is
 * stripped at the sync boundary, not here, so a record read for rendering and
 * a record read for pushing are the same object.
 */
export type StoredRecord = WireRecord & { dirty: boolean };

export type KilorepSchema = DBSchema & {
	/** Every synced record, all kinds together, keyed by their globally unique id. */
	records: {
		key: string;
		value: StoredRecord;
		indexes: { kind: string };
	};
	/**
	 * Local-only oddments: the sync watermark, the active-session snapshot.
	 * Nothing in here ever syncs, which is why it is not a `records` kind.
	 */
	meta: {
		key: string;
		value: unknown;
	};
};

export type KilorepDatabase = IDBPDatabase<KilorepSchema>;

export const DATABASE_NAME = 'kilorep';

/**
 * Opens (and on first run, creates) the device database.
 *
 * The upgrade callback is the only place IndexedDB allows schema work, and it
 * runs migrations by version fallthrough: a future version 2 adds its stores
 * under an `if (oldVersion < 2)` below the first, and an old device replays
 * every step it missed.
 */
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
