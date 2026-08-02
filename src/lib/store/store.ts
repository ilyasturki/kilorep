/**
 * The device store: what PRODUCT.md means by "on the device: everything".
 *
 * One class over the IndexedDB connection, and the only module that reads or
 * writes it. Everything above this file thinks in domain shapes — workouts,
 * history, past sessions — and everything below it is `db.ts`'s schema. The
 * sync envelope (`updatedAt`, `deletedAt`, `dirty`) is decided here, at write
 * time, so a record is born syncable rather than retrofitted on push.
 */

import type { PastSession } from '$lib/domain/stats';
import type { Template } from '$lib/domain/template';
import type { History, Workout } from '$lib/domain/workout';
import type { SyncAck, WireRecord } from '$lib/sync/protocol';

import type { KilorepDatabase } from './db.ts';
import { openDatabase } from './db.ts';
import type { FinishedWorkout, LastPerformed } from './derive.ts';
import { historyFrom, lastPerformedFrom, pastSessionsFrom } from './derive.ts';

/**
 * The in-flight session, exactly as the screen holds it: the tree plus where
 * the cursor was. Local-only by decision — it never becomes a sync record
 * until finished, because half a workout arriving on another device is not a
 * feature, it is a mess to explain.
 */
export type Snapshot = {
	workout: Workout;
	activeSetId: string | null;
};

const WATERMARK_KEY = 'watermark';
const SNAPSHOT_KEY = 'active-session';
const OWNER_KEY = 'owner';

/** `true` when a snapshot-shaped value came back — the fields the resume path reads. */
function isSnapshot(value: unknown): value is Snapshot {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		'workout' in value &&
		'activeSetId' in value
	);
}

export class Store {
	private readonly db: KilorepDatabase;

	public constructor(db: KilorepDatabase) {
		this.db = db;
	}

	// --- workouts -----------------------------------------------------------

	/**
	 * A finished session becomes a record: dirty from birth, `updatedAt`
	 * stamped with the finish. The workout's own id keys the record — minted at
	 * the edge when the session began, exactly so the store could.
	 */
	public async finishWorkout(workout: Workout, finishedAt: number): Promise<void> {
		// Spelled field by field: object spread and `Object.assign` on a literal
		// are both linted out of this layer, and the explicit shape means a field
		// added to `Workout` fails the build here instead of silently syncing.
		const payload: FinishedWorkout = {
			id: workout.id,
			templateId: workout.templateId,
			startedAt: workout.startedAt,
			entries: workout.entries,
			finishedAt
		};

		await this.db.put('records', {
			id: workout.id,
			kind: 'workout',
			updatedAt: finishedAt,
			deletedAt: null,
			payload,
			dirty: true
		});
	}

	/** Every live workout, oldest first. Tombstones stay in the box. */
	public async listWorkouts(): Promise<FinishedWorkout[]> {
		const records = await this.db.getAllFromIndex('records', 'kind', 'workout');

		return (
			records
				.filter((record) => record.deletedAt === null)
				// The one assertion, and it is the storage boundary's: a payload
				// re-read from IndexedDB is `unknown`, and this store is the only
				// writer of the `workout` kind. Same bargain `request<T>` strikes at
				// the network boundary.
				// oxlint-disable-next-line typescript/no-unsafe-type-assertion
				.map((record) => record.payload as FinishedWorkout)
				.toSorted((a, b) => a.startedAt - b.startedAt)
		);
	}

	/** One finished workout by id, or null — unknown, tombstoned, or another kind. */
	public async getWorkout(id: string): Promise<FinishedWorkout | null> {
		const record = await this.db.get('records', id);

		if (record === undefined || record.kind !== 'workout' || record.deletedAt !== null) {
			return null;
		}

		// The storage-boundary assertion `listWorkouts` already makes, for the
		// same reason: this store is the only writer of the kind.
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion
		return record.payload as FinishedWorkout;
	}

	/**
	 * A correction to a session already recorded: the tree as the edit left it,
	 * `updatedAt` stamped afresh, dirty again so the next sync carries it.
	 *
	 * `finishWorkout` cannot serve. It stamps `finishedAt` from its argument, and
	 * an edit is not a second ending — a set fixed on Sunday must not move a
	 * Thursday session's clock. `startedAt` and `templateId` are equally untouched
	 * here, and the caller has no gesture that changes either.
	 *
	 * Read-modify-write rather than a straight `put`, and that is the whole
	 * reason for the transaction: writing the envelope blind would set
	 * `deletedAt: null` over a tombstone that arrived from another device while
	 * this screen was open, resurrecting a workout the user deleted there. An
	 * unknown, tombstoned or wrong-kind id is silently no-op'd, which is what the
	 * screen wants — it has nowhere to put an error, and the record it was
	 * editing is already gone.
	 */
	public async updateWorkout(workout: FinishedWorkout, updatedAt: number): Promise<void> {
		// Spelled field by field, the same bargain `finishWorkout` strikes: a
		// field added to `Workout` fails the build here rather than silently
		// dropping out of an edited record.
		const payload: FinishedWorkout = {
			id: workout.id,
			templateId: workout.templateId,
			startedAt: workout.startedAt,
			entries: workout.entries,
			finishedAt: workout.finishedAt
		};

		const tx = this.db.transaction('records', 'readwrite');
		const record = await tx.store.get(workout.id);

		if (record !== undefined && record.kind === 'workout' && record.deletedAt === null) {
			record.payload = payload;
			record.updatedAt = updatedAt;
			record.dirty = true;
			await tx.store.put(record);
		}

		await tx.done;
	}

	/**
	 * A delete is a tombstone, not a removal — the same bargain as
	 * `deleteTemplate`, and the derivations need no telling: every read path
	 * filters tombstones, so the workout leaves history, hints and PRs in the
	 * one move.
	 */
	public async deleteWorkout(id: string, deletedAt: number): Promise<void> {
		const tx = this.db.transaction('records', 'readwrite');
		const record = await tx.store.get(id);

		if (record !== undefined && record.kind === 'workout') {
			record.deletedAt = deletedAt;
			record.updatedAt = deletedAt;
			record.dirty = true;
			await tx.store.put(record);
		}

		await tx.done;
	}

	/** The hint map for the workout screen — see `historyFrom` for the rules. */
	public async history(): Promise<History> {
		return historyFrom(await this.listWorkouts());
	}

	/**
	 * The last session of every exercise ever performed — what the catalog rows
	 * say under a name. A screen needing the hint map too derives it from this
	 * with `hintsOf` rather than calling `history` as well, which would walk
	 * every stored workout a second time to reach the same answer.
	 */
	public async lastPerformed(): Promise<LastPerformed> {
		return lastPerformedFrom(await this.listWorkouts());
	}

	/** One exercise's past for the detail screen, oldest first. */
	public async pastSessions(exerciseId: string): Promise<PastSession[]> {
		return pastSessionsFrom(await this.listWorkouts(), exerciseId);
	}

	// --- templates ----------------------------------------------------------

	/**
	 * Upsert, because the editor autosaves: the same record is written on every
	 * edit, dirty each time, `updatedAt` stamped by the caller so the clock
	 * stays at the edge with the ids. A partial plan crossing the wire is fine —
	 * sync is last-write-wins per record and the final save settles it.
	 */
	public async saveTemplate(template: Template, updatedAt: number): Promise<void> {
		// Spelled field by field, same bargain as `finishWorkout`: a field added
		// to `Template` fails the build here instead of silently syncing.
		const payload: Template = {
			id: template.id,
			name: template.name,
			createdAt: template.createdAt,
			entries: template.entries
		};

		await this.db.put('records', {
			id: template.id,
			kind: 'template',
			updatedAt,
			deletedAt: null,
			payload,
			dirty: true
		});
	}

	/** Every live template, creation order. Tombstones stay in the box. */
	public async listTemplates(): Promise<Template[]> {
		const records = await this.db.getAllFromIndex('records', 'kind', 'template');

		return (
			records
				.filter((record) => record.deletedAt === null)
				// The storage-boundary assertion `listWorkouts` already makes, for the
				// same reason: this store is the only writer of the kind.
				// oxlint-disable-next-line typescript/no-unsafe-type-assertion
				.map((record) => record.payload as Template)
				.toSorted((a, b) => a.createdAt - b.createdAt)
		);
	}

	/** One template by id, or null — unknown, tombstoned, or not a template at all. */
	public async getTemplate(id: string): Promise<Template | null> {
		const record = await this.db.get('records', id);

		if (record === undefined || record.kind !== 'template' || record.deletedAt !== null) {
			return null;
		}

		// oxlint-disable-next-line typescript/no-unsafe-type-assertion
		return record.payload as Template;
	}

	/**
	 * A delete is a tombstone, not a removal — CLAUDE.md: without one, the next
	 * pull resurrects the record. `updatedAt` is bumped along with `deletedAt`,
	 * because last-write-wins compares nothing else: a tombstone carrying the
	 * old timestamp would lose to the server's live copy and undelete itself.
	 */
	public async deleteTemplate(id: string, deletedAt: number): Promise<void> {
		const tx = this.db.transaction('records', 'readwrite');
		const record = await tx.store.get(id);

		if (record !== undefined && record.kind === 'template') {
			record.deletedAt = deletedAt;
			record.updatedAt = deletedAt;
			record.dirty = true;
			await tx.store.put(record);
		}

		await tx.done;
	}

	// --- the active session -------------------------------------------------

	public async saveSnapshot(snapshot: Snapshot): Promise<void> {
		await this.db.put('meta', snapshot, SNAPSHOT_KEY);
	}

	public async loadSnapshot(): Promise<Snapshot | null> {
		const value = await this.db.get('meta', SNAPSHOT_KEY);

		return isSnapshot(value) ? value : null;
	}

	public async clearSnapshot(): Promise<void> {
		await this.db.delete('meta', SNAPSHOT_KEY);
	}

	// --- sync ---------------------------------------------------------------

	/** Everything still owed to the server, as the wire will carry it. */
	public async dirtyRecords(): Promise<WireRecord[]> {
		const records = await this.db.getAll('records');

		return records
			.filter((record) => record.dirty)
			.map(({ id, kind, updatedAt, deletedAt, payload }) => ({
				id,
				kind,
				updatedAt,
				deletedAt,
				payload
			}));
	}

	/**
	 * Settles the dirty flags a successful push earned — but only where the
	 * record still holds the exact `updatedAt` that was pushed. An edit made
	 * while the request was in flight bumped it, the flag stays, and the next
	 * sync carries the newer version. That comparison is the whole reason acks
	 * name a timestamp instead of just an id.
	 */
	public async acknowledge(acks: SyncAck[]): Promise<void> {
		const tx = this.db.transaction('records', 'readwrite');

		for (const ack of acks) {
			const record = await tx.store.get(ack.id);

			if (record !== undefined && record.dirty && record.updatedAt === ack.updatedAt) {
				record.dirty = false;
				await tx.store.put(record);
			}
		}

		await tx.done;
	}

	/**
	 * Applies a pull: last-write-wins per record, the same rule the server
	 * runs. `>=` and not `>`, so the server's copy of a tie settles the local
	 * one clean — which is what makes re-applying a pull idempotent. A local
	 * record that is strictly newer survives untouched; it is dirty by
	 * construction and the next push carries it up.
	 */
	public async applyRemote(records: WireRecord[]): Promise<void> {
		const tx = this.db.transaction('records', 'readwrite');

		for (const remote of records) {
			const local = await tx.store.get(remote.id);

			if (local === undefined || remote.updatedAt >= local.updatedAt) {
				await tx.store.put({
					id: remote.id,
					kind: remote.kind,
					updatedAt: remote.updatedAt,
					deletedAt: remote.deletedAt,
					payload: remote.payload,
					dirty: false
				});
			}
		}

		await tx.done;
	}

	/** The highest server `seq` this device has applied. Zero before first pull. */
	public async watermark(): Promise<number> {
		const value = await this.db.get('meta', WATERMARK_KEY);

		return typeof value === 'number' ? value : 0;
	}

	public async setWatermark(seq: number): Promise<void> {
		await this.db.put('meta', seq, WATERMARK_KEY);
	}

	/**
	 * Ties the store to the one account it syncs with. True when the store is
	 * unowned (first sync claims it) or already owned by `userId`; false on a
	 * mismatch, and the caller must not sync — pushing one account's records
	 * into another is the worst thing this layer could do, and refusing is the
	 * whole guard. A second account on one browser is out of scope by product
	 * shape (self-hosted, one lifter), not by accident.
	 */
	public async claimOwner(userId: string): Promise<boolean> {
		const value = await this.db.get('meta', OWNER_KEY);

		if (typeof value === 'string') {
			return value === userId;
		}

		await this.db.put('meta', userId, OWNER_KEY);

		return true;
	}
}

async function openStore(): Promise<Store> {
	return new Store(await openDatabase());
}

let opening: Promise<Store> | undefined;

/**
 * The app's one store, opened on first use. The memo holds the promise rather
 * than the instance so two callers racing on first use share one open instead
 * of opening twice — every caller is inside a `load` or an event handler that
 * can await.
 */
export async function getStore(): Promise<Store> {
	opening ??= openStore();
	const store = await opening;

	return store;
}
