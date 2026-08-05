import type { BodyweightEntry, ChartRange } from '$lib/domain/bodyweight';
import { bodyweightId } from '$lib/domain/bodyweight';
import type { ExertionScale } from '$lib/domain/exertion';
import type {
	ExertionScalePreference,
	NotePreference,
	RestDefaultPreference,
	RestOverridePreference,
	WeightRangePreference
} from '$lib/domain/preference';
import {
	EXERTION_SCALE_ID,
	MAIN_VARIANT_PREFIX,
	REST_DEFAULT_ID,
	WEIGHT_RANGE_ID,
	isExertionScalePreference,
	isNotePreference,
	isRestDefaultPreference,
	isRestOverridePreference,
	isWeightRangePreference,
	noteId,
	restOverrideExercise,
	restOverrideId
} from '$lib/domain/preference';
import { defaultRestSettings, settleRestSeconds } from '$lib/domain/rest';
import type { RestSettings } from '$lib/domain/rest';
import type { PastSession } from '$lib/domain/stats';
import type { Template } from '$lib/domain/template';
import { byRank } from '$lib/domain/template';
import type { History, Workout } from '$lib/domain/workout';
import type { RecordKind, SyncAck, WireRecord } from '$lib/sync/protocol';

import type { KilorepDatabase } from './db.ts';
import { openDatabase } from './db.ts';
import type { FinishedWorkout, LastPerformed } from './derive.ts';
import { frequentFrom, hintsOf, lastPerformedFrom, pastSessionsFrom } from './derive.ts';

/**
 * A rest caught mid-flight, so a reload does not forget one.
 *
 * An absolute `endsAt` and never a countdown: the WebView is suspended the
 * moment the screen goes dark, and a remembered "ninety seconds left" would
 * come back claiming ninety seconds no matter how long the phone spent in a
 * pocket. `seconds` rides along because the bar's track needs to know how long
 * the whole rest was to draw how much of it is gone.
 */
export type RestSnapshot = {
	endsAt: number;
	seconds: number;
	exerciseId: string;
};

export type Snapshot = {
	workout: Workout;
	activeSetId: string | null;
	rest: RestSnapshot | null;
	/** Rest silenced for the remainder of this session. Dies with it. */
	muted: boolean;
};

const WATERMARK_KEY = 'watermark';
const SNAPSHOT_KEY = 'active-session';
const OWNER_KEY = 'owner';

type LegacySnapshot = Omit<Snapshot, 'rest' | 'muted'> & Partial<Pick<Snapshot, 'rest' | 'muted'>>;

function isSnapshot(value: unknown): value is LegacySnapshot {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		'workout' in value &&
		'activeSetId' in value
	);
}

function isRestSnapshot(value: unknown): value is RestSnapshot {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		'endsAt' in value &&
		typeof value.endsAt === 'number' &&
		'seconds' in value &&
		typeof value.seconds === 'number' &&
		'exerciseId' in value &&
		typeof value.exerciseId === 'string'
	);
}

/**
 * The two rest fields arrived after snapshots existed, and a device mid-session
 * when the app updates holds one without them. Filling them in is the whole
 * reason this is a normaliser rather than a guard: rejecting the shape would
 * discard a half-logged workout to gain a feature that had not started yet.
 */
function settleSnapshot(value: LegacySnapshot): Snapshot {
	return {
		workout: value.workout,
		activeSetId: value.activeSetId,
		rest: isRestSnapshot(value.rest) ? value.rest : null,
		muted: value.muted === true
	};
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
			entries: template.entries,
			mark: template.mark ?? null,
			order: template.order,
			archivedAt: template.archivedAt ?? null
		};

		await this.write(template.id, 'template', updatedAt, payload);
	}

	/**
	 * Every live template, marked and unmarked, archived and not, in list order.
	 *
	 * The archived ones come back with the rest rather than being filtered here,
	 * because two screens want different halves of the same answer — the list
	 * draws both in two groups and the idle Train screen draws only the active
	 * ones — and a store method per audience would have them disagreeing about
	 * ordering the first time one of them changed. `isArchived` splits it at the
	 * call site.
	 */
	public async listTemplates(): Promise<Template[]> {
		const templates = await this.live<Template>('template', byRank);

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

	public async setWeightRange(range: ChartRange, updatedAt: number): Promise<void> {
		const payload: WeightRangePreference = { range };

		await this.write(WEIGHT_RANGE_ID, 'preference', updatedAt, payload);
	}

	public async weightRange(): Promise<ChartRange> {
		const record = await this.db.get('records', WEIGHT_RANGE_ID);

		if (record === undefined || record.deletedAt !== null) {
			return '12w';
		}

		return isWeightRangePreference(record.payload) ? record.payload.range : '12w';
	}

	public async setRestDefault(preference: RestDefaultPreference, updatedAt: number): Promise<void> {
		const payload: RestDefaultPreference = {
			enabled: preference.enabled,
			seconds: settleRestSeconds(preference.seconds)
		};

		await this.write(REST_DEFAULT_ID, 'preference', updatedAt, payload);
	}

	/**
	 * One pass over the `preference` index rather than a read per exercise. A
	 * session touches a dozen exercises and the tab bar wants this before the
	 * first set, so a dozen indexed gets on the boot path is a dozen too many.
	 */
	public async restSettings(): Promise<RestSettings> {
		const records = await this.db.getAllFromIndex('records', 'kind', 'preference');

		const settings = defaultRestSettings();

		for (const record of records.filter((live) => live.deletedAt === null)) {
			if (record.id === REST_DEFAULT_ID && isRestDefaultPreference(record.payload)) {
				settings.enabled = record.payload.enabled;
				settings.seconds = settleRestSeconds(record.payload.seconds);

				continue;
			}

			const exerciseId = restOverrideExercise(record.id);

			if (exerciseId === null || !isRestOverridePreference(record.payload)) {
				continue;
			}

			settings.overrides[exerciseId] =
				record.payload.seconds === null ? null : settleRestSeconds(record.payload.seconds);
		}

		return settings;
	}

	/**
	 * One exercise's own duration, or `null` for never-rest. Clearing an override
	 * is `clearRestOverride` and not a write of null — the two are different
	 * answers, and only one of them is "no opinion".
	 */
	public async setRestOverride(
		exerciseId: string,
		seconds: number | null,
		updatedAt: number
	): Promise<void> {
		const payload: RestOverridePreference = {
			seconds: seconds === null ? null : settleRestSeconds(seconds)
		};

		await this.write(restOverrideId(exerciseId), 'preference', updatedAt, payload);
	}

	public async clearRestOverride(exerciseId: string, deletedAt: number): Promise<void> {
		await this.tombstone(restOverrideId(exerciseId), 'preference', deletedAt);
	}

	/**
	 * One exercise's note, or `''` where there is none — the empty string is the
	 * absence, because nothing downstream distinguishes "never written" from
	 * "written and cleared" and a `null` would only make every caller say so.
	 *
	 * Read by id rather than by the scan `restSettings` does: one screen wants
	 * this, on a navigation, and no boot path needs every note in memory.
	 */
	public async exerciseNote(exerciseId: string): Promise<string> {
		const payload = await this.liveOne<unknown>(noteId(exerciseId), 'preference');

		return isNotePreference(payload) ? payload.text : '';
	}

	public async setExerciseNote(exerciseId: string, text: string, updatedAt: number): Promise<void> {
		const payload: NotePreference = { text };

		await this.write(noteId(exerciseId), 'preference', updatedAt, payload);
	}

	public async clearExerciseNote(exerciseId: string, deletedAt: number): Promise<void> {
		await this.tombstone(noteId(exerciseId), 'preference', deletedAt);
	}

	public async saveSnapshot(snapshot: Snapshot): Promise<void> {
		await this.db.put('meta', snapshot, SNAPSHOT_KEY);
	}

	/**
	 * The rest half of the snapshot, without the workout half.
	 *
	 * The bar is docked in the tab layout and answers a thumb from any screen in
	 * the app, so a skip can happen with the workout page unmounted and its
	 * save effect not running. Read-modify-write rather than a `put`, for the
	 * reason `updateWorkout` uses one: writing the whole snapshot from here would
	 * need a tree this caller does not have, and inventing one would overwrite
	 * the session.
	 *
	 * Silently no-op when no session is stored — a rest cannot outlive the
	 * workout that started it, and there is nothing to attach this to.
	 */
	public async saveRest(rest: RestSnapshot | null, muted: boolean): Promise<void> {
		const tx = this.db.transaction('meta', 'readwrite');
		const value = await tx.store.get(SNAPSHOT_KEY);

		if (isSnapshot(value)) {
			await tx.store.put(Object.assign(settleSnapshot(value), { rest, muted }), SNAPSHOT_KEY);
		}

		await tx.done;
	}

	public async loadSnapshot(): Promise<Snapshot | null> {
		const value = await this.db.get('meta', SNAPSHOT_KEY);

		return isSnapshot(value) ? settleSnapshot(value) : null;
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

	/**
	 * Every record marked as never having been pushed. What both handovers
	 * below start from: a record's `dirty` flag says whether *this* store's
	 * server has seen it, and the moment the account behind that server changes
	 * — or stops existing — the answer for every clean record is no.
	 *
	 * The watermark goes back to zero with it, on the same grounds: it counts
	 * one account's `seq`, and it would step a new one's first pull straight
	 * over everything already there.
	 */
	private async freshenAll(): Promise<void> {
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
	}

	public async adopt(userId: string): Promise<void> {
		await this.freshenAll();

		await this.db.put('meta', userId, OWNER_KEY);
	}

	/**
	 * The account is gone and these records are not — someone deleted theirs and
	 * asked to keep what is on the device.
	 *
	 * The owner key is removed rather than rewritten, which leaves the store in
	 * the state a fresh install has: unowned, and so claimable outright by the
	 * next account to sign in here. That is the trade this makes plain — on a
	 * shared browser the next person to sign in inherits the history, with no
	 * question asked, because there is no longer an account for `claimOwner` to
	 * ask about.
	 */
	public async disown(): Promise<void> {
		await this.freshenAll();

		await this.db.delete('meta', OWNER_KEY);
	}

	/**
	 * Nothing local survives. `userId` is who the empty store then belongs to —
	 * null when there is nobody, which is the account-deletion path: the records
	 * are gone and so is the account that would have claimed what replaces them.
	 */
	public async wipe(userId: string | null): Promise<void> {
		await this.db.clear('records');
		await this.clearSnapshot();
		await this.setWatermark(0);

		if (userId === null) {
			await this.db.delete('meta', OWNER_KEY);
			return;
		}

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
