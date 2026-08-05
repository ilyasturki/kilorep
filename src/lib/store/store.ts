import type { BodyweightEntry } from '$lib/domain/bodyweight';
import { bodyweightId } from '$lib/domain/bodyweight';
import type { ExertionScale } from '$lib/domain/exertion';
import type { ExertionScalePreference } from '$lib/domain/preference';
import {
	EXERTION_SCALE_ID,
	MAIN_VARIANT_PREFIX,
	isExertionScalePreference
} from '$lib/domain/preference';
import type { PastSession } from '$lib/domain/stats';
import type { Template } from '$lib/domain/template';
import type { History, Workout } from '$lib/domain/workout';
import type { RecordKind, SyncAck, WireRecord } from '$lib/sync/protocol';

import type { KilorepDatabase } from './db.ts';
import { openDatabase } from './db.ts';
import type { FinishedWorkout, LastPerformed } from './derive.ts';
import { frequentFrom, hintsOf, lastPerformedFrom, pastSessionsFrom } from './derive.ts';

export type Snapshot = {
	workout: Workout;
	activeSetId: string | null;
};

const WATERMARK_KEY = 'watermark';
const SNAPSHOT_KEY = 'active-session';
const OWNER_KEY = 'owner';

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

	/**
	 * A record born syncable: dirty from birth, the caller's clock on
	 * `updatedAt`. Every write path below goes through here, so the sync
	 * envelope is decided in one place rather than five.
	 */
	private async write(
		id: string,
		kind: RecordKind,
		updatedAt: number,
		payload: unknown
	): Promise<void> {
		await this.db.put('records', { id, kind, updatedAt, deletedAt: null, payload, dirty: true });
	}

	private async tombstone(id: string, kind: RecordKind, deletedAt: number): Promise<void> {
		const tx = this.db.transaction('records', 'readwrite');
		const record = await tx.store.get(id);

		if (record !== undefined && record.kind === kind) {
			record.deletedAt = deletedAt;
			record.updatedAt = deletedAt;
			record.dirty = true;
			await tx.store.put(record);
		}

		await tx.done;
	}

	private async live<T>(kind: RecordKind, compare: (a: T, b: T) => number): Promise<T[]> {
		const records = await this.db.getAllFromIndex('records', 'kind', kind);

		return (
			records
				.filter((record) => record.deletedAt === null)
				// oxlint-disable-next-line typescript/no-unsafe-type-assertion
				.map((record) => record.payload as T)
				.toSorted(compare)
		);
	}

	private async liveOne<T>(id: string, kind: RecordKind): Promise<T | null> {
		const record = await this.db.get('records', id);

		if (record === undefined || record.kind !== kind || record.deletedAt !== null) {
			return null;
		}

		// oxlint-disable-next-line typescript/no-unsafe-type-assertion
		return record.payload as T;
	}

	public async finishWorkout(workout: Workout, finishedAt: number): Promise<void> {
		const payload: FinishedWorkout = {
			id: workout.id,
			templateId: workout.templateId,
			startedAt: workout.startedAt,
			entries: workout.entries,
			finishedAt
		};

		await this.write(workout.id, 'workout', finishedAt, payload);
	}

	public async listWorkouts(): Promise<FinishedWorkout[]> {
		const workouts = await this.live<FinishedWorkout>(
			'workout',
			(a, b) => a.startedAt - b.startedAt
		);

		return workouts;
	}

	public async getWorkout(id: string): Promise<FinishedWorkout | null> {
		const workout = await this.liveOne<FinishedWorkout>(id, 'workout');

		return workout;
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

	public async deleteWorkout(id: string, deletedAt: number): Promise<void> {
		await this.tombstone(id, 'workout', deletedAt);
	}

	public async history(): Promise<History> {
		return hintsOf(lastPerformedFrom(await this.listWorkouts()));
	}

	public async lastPerformed(): Promise<LastPerformed> {
		return lastPerformedFrom(await this.listWorkouts());
	}

	public async pickerData(): Promise<{ lastPerformed: LastPerformed; frequent: string[] }> {
		const workouts = await this.listWorkouts();

		return {
			lastPerformed: lastPerformedFrom(workouts),
			frequent: frequentFrom(workouts)
		};
	}

	public async pastSessions(exerciseId: string): Promise<PastSession[]> {
		return pastSessionsFrom(await this.listWorkouts(), exerciseId);
	}

	/**
	 * Upsert, because the editor autosaves: the same record is written on every
	 * edit, dirty each time, `updatedAt` stamped by the caller so the clock
	 * stays at the edge with the ids. A partial plan crossing the wire is fine —
	 * sync is last-write-wins per record and the final save settles it.
	 */
	public async saveTemplate(template: Template, updatedAt: number): Promise<void> {
		const payload: Template = {
			id: template.id,
			name: template.name,
			createdAt: template.createdAt,
			entries: template.entries
		};

		await this.write(template.id, 'template', updatedAt, payload);
	}

	public async listTemplates(): Promise<Template[]> {
		const templates = await this.live<Template>('template', (a, b) => a.createdAt - b.createdAt);

		return templates;
	}

	public async getTemplate(id: string): Promise<Template | null> {
		const template = await this.liveOne<Template>(id, 'template');

		return template;
	}

	public async deleteTemplate(id: string, deletedAt: number): Promise<void> {
		await this.tombstone(id, 'template', deletedAt);
	}

	public async saveBodyweight(entry: BodyweightEntry, updatedAt: number): Promise<void> {
		const payload: BodyweightEntry = {
			date: entry.date,
			kg: entry.kg
		};

		await this.write(bodyweightId(entry.date), 'bodyweight', updatedAt, payload);
	}

	public async listBodyweight(): Promise<BodyweightEntry[]> {
		const entries = await this.live<BodyweightEntry>('bodyweight', (a, b) =>
			a.date < b.date ? -1 : 1
		);

		return entries;
	}

	public async deleteBodyweight(date: string, deletedAt: number): Promise<void> {
		await this.tombstone(bodyweightId(date), 'bodyweight', deletedAt);
	}

	/**
	 * Clears out the retired main-variant preference, everywhere: a tombstone
	 * rather than a delete, so the row leaves the server too instead of being
	 * pulled back down on the next sync. The client stamps `deletedAt` and marks
	 * the record dirty; the `seq` that orders it is the server's to claim, in the
	 * same transaction as the upsert that consumes it.
	 *
	 * Run on every open and idempotent by construction — a record already
	 * tombstoned no longer matches. That is what answers the device still on the
	 * old build: it can push a main variant back with a fresher clock, and the
	 * next open here buries it again.
	 */
	public async dropMainVariants(deletedAt: number): Promise<void> {
		const tx = this.db.transaction('records', 'readwrite');

		let cursor = await tx.store.index('kind').openCursor('preference');
		while (cursor !== null) {
			const record = cursor.value;

			if (record.id.startsWith(MAIN_VARIANT_PREFIX) && record.deletedAt === null) {
				record.deletedAt = deletedAt;
				record.updatedAt = deletedAt;
				record.dirty = true;
				await cursor.update(record);
			}

			cursor = await cursor.continue();
		}

		await tx.done;
	}

	public async setExertionScale(scale: ExertionScale, updatedAt: number): Promise<void> {
		const payload: ExertionScalePreference = { scale };

		await this.write(EXERTION_SCALE_ID, 'preference', updatedAt, payload);
	}

	public async exertionScale(): Promise<ExertionScale> {
		const record = await this.db.get('records', EXERTION_SCALE_ID);

		if (record === undefined || record.deletedAt !== null) {
			return 'rpe';
		}

		return isExertionScalePreference(record.payload) ? record.payload.scale : 'rpe';
	}

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

	public async watermark(): Promise<number> {
		const value = await this.db.get('meta', WATERMARK_KEY);

		return typeof value === 'number' ? value : 0;
	}

	public async setWatermark(seq: number): Promise<void> {
		await this.db.put('meta', seq, WATERMARK_KEY);
	}

	public async claimOwner(userId: string): Promise<boolean> {
		const value = await this.db.get('meta', OWNER_KEY);

		if (typeof value === 'string') {
			return value === userId;
		}

		await this.db.put('meta', userId, OWNER_KEY);

		return true;
	}

	public async owner(): Promise<string | null> {
		const value = await this.db.get('meta', OWNER_KEY);

		return typeof value === 'string' ? value : null;
	}

	public async adopt(userId: string): Promise<void> {
		const tx = this.db.transaction('records', 'readwrite');

		let cursor = await tx.store.openCursor();
		while (cursor !== null) {
			const record = cursor.value;

			if (!record.dirty) {
				record.dirty = true;
				await cursor.update(record);
			}

			cursor = await cursor.continue();
		}

		await tx.done;

		await this.setWatermark(0);
		await this.db.put('meta', userId, OWNER_KEY);
	}

	public async wipe(userId: string): Promise<void> {
		await this.db.clear('records');
		await this.clearSnapshot();
		await this.setWatermark(0);
		await this.db.put('meta', userId, OWNER_KEY);
	}
}

async function openStore(): Promise<Store> {
	const store = new Store(await openDatabase());

	await store.dropMainVariants(Date.now());

	return store;
}

let opening: Promise<Store> | undefined;

export async function getStore(): Promise<Store> {
	opening ??= openStore();
	const store = await opening;

	return store;
}
