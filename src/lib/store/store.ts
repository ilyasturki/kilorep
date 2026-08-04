/**
 * The device store: what PRODUCT.md means by "on the device: everything".
 *
 * One class over the IndexedDB connection, and the only module that reads or
 * writes it. Everything above this file thinks in domain shapes — workouts,
 * history, past sessions — and everything below it is `db.ts`'s schema. The
 * sync envelope (`updatedAt`, `deletedAt`, `dirty`) is decided here, at write
 * time, so a record is born syncable rather than retrofitted on push.
 */

import type { BodyweightEntry } from '$lib/domain/bodyweight';
import { bodyweightId } from '$lib/domain/bodyweight';
import type { ExertionScale } from '$lib/domain/exertion';
import type { ExertionScalePreference, MainVariant, MainVariants } from '$lib/domain/preference';
import {
	EXERTION_SCALE_ID,
	isExertionScalePreference,
	isMainVariant,
	mainVariantId
} from '$lib/domain/preference';
import type { PastSession } from '$lib/domain/stats';
import type { Template } from '$lib/domain/template';
import type { History, Workout } from '$lib/domain/workout';
import type { RecordKind, SyncAck, WireRecord } from '$lib/sync/protocol';

import type { KilorepDatabase } from './db.ts';
import { openDatabase } from './db.ts';
import type { FinishedWorkout, LastPerformed } from './derive.ts';
import { frequentFrom, hintsOf, lastPerformedFrom, pastSessionsFrom } from './derive.ts';

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

	/**
	 * A delete is a tombstone, not a removal — CLAUDE.md: without one, the next
	 * pull resurrects the record. `updatedAt` is bumped along with `deletedAt`,
	 * because last-write-wins compares nothing else: a tombstone carrying the
	 * old timestamp would lose to the server's live copy and undelete itself.
	 *
	 * Read-modify-write, so an id of the wrong kind is silently no-op'd rather
	 * than tombstoned.
	 */
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

	/**
	 * Every live record of a kind, ordered by `compare`. Tombstones stay in the
	 * box.
	 *
	 * The one assertion, and it is the storage boundary's: a payload re-read
	 * from IndexedDB is `unknown`, and this store is the only writer of the
	 * kinds that reach here. Same bargain `request<T>` strikes at the network
	 * boundary — which is why `preference` reads guard instead, another app
	 * version being a writer of that kind too.
	 */
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

	/** One live record by id, or null — unknown, tombstoned, or another kind. */
	private async liveOne<T>(id: string, kind: RecordKind): Promise<T | null> {
		const record = await this.db.get('records', id);

		if (record === undefined || record.kind !== kind || record.deletedAt !== null) {
			return null;
		}

		// oxlint-disable-next-line typescript/no-unsafe-type-assertion
		return record.payload as T;
	}

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

		await this.write(workout.id, 'workout', finishedAt, payload);
	}

	/** Every live workout, oldest first. */
	public async listWorkouts(): Promise<FinishedWorkout[]> {
		const workouts = await this.live<FinishedWorkout>(
			'workout',
			(a, b) => a.startedAt - b.startedAt
		);

		return workouts;
	}

	/** One finished workout by id, or null — unknown, tombstoned, or another kind. */
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

	/**
	 * The derivations need no telling: every read path filters tombstones, so
	 * the workout leaves history, hints and PRs in the one move.
	 */
	public async deleteWorkout(id: string, deletedAt: number): Promise<void> {
		await this.tombstone(id, 'workout', deletedAt);
	}

	/** The hint map for the workout screen — see `lastPerformedFrom` for the rules. */
	public async history(): Promise<History> {
		return hintsOf(lastPerformedFrom(await this.listWorkouts()));
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

	/**
	 * Everything an exercise picker is made of, from one walk: the last session
	 * under every row, and the shelf of what is actually trained that sits above
	 * the muscle sections.
	 *
	 * One method rather than two calls for the same reason `lastPerformed` asks
	 * screens not to call `history` alongside it — both answers come out of the
	 * same records, and every consumer needs both, so asking twice would read
	 * every stored workout twice to fill one sheet.
	 */
	public async pickerData(): Promise<{
		lastPerformed: LastPerformed;
		frequent: string[];
		mains: MainVariants;
	}> {
		const workouts = await this.listWorkouts();

		return {
			lastPerformed: lastPerformedFrom(workouts),
			frequent: frequentFrom(workouts),
			mains: await this.mainVariants()
		};
	}

	/** One exercise's past for the detail screen, oldest first. */
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
		// Spelled field by field, same bargain as `finishWorkout`: a field added
		// to `Template` fails the build here instead of silently syncing.
		const payload: Template = {
			id: template.id,
			name: template.name,
			createdAt: template.createdAt,
			entries: template.entries
		};

		await this.write(template.id, 'template', updatedAt, payload);
	}

	/** Every live template, creation order. */
	public async listTemplates(): Promise<Template[]> {
		const templates = await this.live<Template>('template', (a, b) => a.createdAt - b.createdAt);

		return templates;
	}

	/** One template by id, or null — unknown, tombstoned, or not a template at all. */
	public async getTemplate(id: string): Promise<Template | null> {
		const template = await this.liveOne<Template>(id, 'template');

		return template;
	}

	public async deleteTemplate(id: string, deletedAt: number): Promise<void> {
		await this.tombstone(id, 'template', deletedAt);
	}

	/**
	 * Upsert by day: the id is derived from the entry's date, so "one per day,
	 * re-logging overwrites" is a same-key put rather than a rule anyone
	 * enforces. A blind put on purpose, unlike `updateWorkout`'s read-modify —
	 * writing over a tombstone here is not an accident to guard against but the
	 * gesture's meaning: logging a weight for a day is an affirmative claim
	 * about that day, deleted before or not.
	 */
	public async saveBodyweight(entry: BodyweightEntry, updatedAt: number): Promise<void> {
		// Spelled field by field, same bargain as `finishWorkout`: a field added
		// to `BodyweightEntry` fails the build here instead of silently syncing.
		const payload: BodyweightEntry = {
			date: entry.date,
			kg: entry.kg
		};

		await this.write(bodyweightId(entry.date), 'bodyweight', updatedAt, payload);
	}

	/** Every live entry, oldest day first — ISO dates, so the calendar sort is a string sort. */
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
	 * Upsert by family: the id is derived from the family's slug, so "one choice
	 * per family, re-choosing overwrites" is a same-key put rather than a rule
	 * anyone enforces. A blind put like `saveBodyweight`'s, and for the same
	 * reason — choosing a main is an affirmative claim about the family, and
	 * whatever an earlier record held is exactly what the choice replaces.
	 */
	public async setMainVariant(preference: MainVariant, updatedAt: number): Promise<void> {
		// Spelled field by field, same bargain as `finishWorkout`: a field added
		// to `MainVariant` fails the build here instead of silently syncing.
		const payload: MainVariant = {
			family: preference.family,
			main: preference.main
		};

		await this.write(mainVariantId(preference.family), 'preference', updatedAt, payload);
	}

	/**
	 * Every family's chosen main, as the browse fold reads it. Guarded rather
	 * than asserted, unlike the other kinds' reads: `preference` is a kind other
	 * app versions will grow shapes into, and an unrecognised payload must fall
	 * out of the map rather than poison it — see `isMainVariant`.
	 */
	public async mainVariants(): Promise<MainVariants> {
		const records = await this.db.getAllFromIndex('records', 'kind', 'preference');

		const mains: MainVariants = {};

		for (const record of records) {
			if (record.deletedAt === null && isMainVariant(record.payload)) {
				mains[record.payload.family] = record.payload.main;
			}
		}

		return mains;
	}

	/**
	 * The one exertion-scale choice, upserted on a constant id — there is only
	 * ever one, so unlike `setMainVariant` there is no family to key it by.
	 *
	 * A blind put, same as that one: choosing a scale is an affirmative claim
	 * and whatever was there is exactly what it replaces.
	 */
	public async setExertionScale(scale: ExertionScale, updatedAt: number): Promise<void> {
		// The annotation is the only thing typing `{ scale }`, same bargain as
		// `finishWorkout`: a field added to `ExertionScalePreference` fails the
		// build here instead of silently syncing.
		const payload: ExertionScalePreference = { scale };

		await this.write(EXERTION_SCALE_ID, 'preference', updatedAt, payload);
	}

	/**
	 * The chosen scale, defaulting to RPE for an account that has never said.
	 *
	 * Guarded rather than asserted, for `mainVariants`' reason: another app
	 * version is a writer of this kind too. A tombstoned or unrecognisable
	 * record falls back to the default rather than leaving the picker with no
	 * name to wear.
	 */
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

	/**
	 * Which account this store belongs to, asked without claiming it.
	 *
	 * `claimOwner` cannot answer this: asking it on an unowned store *makes* it
	 * owned, which is right for sync and wrong for a sign-in that has not yet
	 * found out whether it needs to offer a choice.
	 */
	public async owner(): Promise<string | null> {
		const value = await this.db.get('meta', OWNER_KEY);

		return typeof value === 'string' ? value : null;
	}

	/**
	 * Moves everything on this device into `userId`'s account — the merge half
	 * of what a sign-in offers when the store belongs to somebody else.
	 *
	 * Three writes that only make sense together. Every record goes dirty,
	 * including the ones a previous account already settled, because their acks
	 * were that account's and mean nothing here. The watermark drops to zero, so
	 * the first pull walks the new account's history from the start rather than
	 * from a `seq` counted on another tenant's counter. The owner is overwritten
	 * last.
	 *
	 * Nothing is destroyed, on either side. Records are keyed `(userId, id)` on
	 * the server, so these arrive as the new account's own rows and the old
	 * account keeps its copies untouched — which is what makes this the
	 * non-destructive option of the two.
	 */
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

	/**
	 * Empties the device and hands it to `userId` — the wipe half, for the phone
	 * that changed hands.
	 *
	 * Records first and the owner last, so an interruption anywhere in the middle
	 * leaves a store that is emptier than it was but still stamped with the old
	 * account. That direction is the survivable one: the sign-in can be tried
	 * again, and the alternative ordering would leave the new owner's stamp over
	 * records that were never theirs.
	 *
	 * The snapshot goes with them. A half-logged session belongs to whoever was
	 * lifting, and resuming someone else's sets into a new account is the exact
	 * confusion this option was chosen to end.
	 */
	public async wipe(userId: string): Promise<void> {
		await this.db.clear('records');
		await this.clearSnapshot();
		await this.setWatermark(0);
		await this.db.put('meta', userId, OWNER_KEY);
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
