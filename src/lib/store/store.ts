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
import type { FinishedWorkout, LastGrips, LastPerformed } from './derive.ts';
import {
	frequentFrom,
	gripSessionsFrom,
	historyFrom,
	lastGripsFrom,
	lastPerformedFrom,
	pastSessionsFrom
} from './derive.ts';
import { foldTemplate, foldWorkout } from './fold.ts';

// Absolute `endsAt`, never a remaining countdown: the WebView is suspended while the
// screen is dark, and a countdown would resume as if no time had passed.
export type RestSnapshot = {
	endsAt: number;
	seconds: number;
	exerciseId: string;
};

export type Snapshot = {
	workout: Workout;
	activeSetId: string | null;
	rest: RestSnapshot | null;
	muted: boolean;
};

const WATERMARK_KEY = 'watermark';
const SNAPSHOT_KEY = 'active-session';
const OWNER_KEY = 'owner';
const SYNCED_KEY = 'syncedAt';

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

// `rest` and `muted` postdate existing snapshots; normalise rather than reject so an
// upgrade mid-session keeps the half-logged workout.
function settleSnapshot(value: LegacySnapshot): Snapshot {
	return {
		// Folded like every other read: a session in flight when the app upgraded is the one
		// place a retired slug can reach the screen, and the screen has no entry for it.
		workout: foldWorkout(value.workout),
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

		return workouts.map((workout) => foldWorkout(workout));
	}

	public async getWorkout(id: string): Promise<FinishedWorkout | null> {
		const workout = await this.liveOne<FinishedWorkout>(id, 'workout');

		return workout === null ? null : foldWorkout(workout);
	}

	// Read-modify-write: a blind put would set `deletedAt: null` over a tombstone that
	// arrived from another device mid-edit, resurrecting a workout deleted there.
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
		return historyFrom(await this.listWorkouts());
	}

	public async lastPerformed(): Promise<LastPerformed> {
		return lastPerformedFrom(await this.listWorkouts());
	}

	public async pickerData(): Promise<{
		lastPerformed: LastPerformed;
		frequent: string[];
		history: History;
		grips: LastGrips;
	}> {
		const workouts = await this.listWorkouts();

		return {
			lastPerformed: lastPerformedFrom(workouts),
			frequent: frequentFrom(workouts),
			history: historyFrom(workouts),
			grips: lastGripsFrom(workouts)
		};
	}

	public async pastSessions(exerciseId: string): Promise<PastSession[]> {
		return pastSessionsFrom(await this.listWorkouts(), exerciseId);
	}

	public async gripSessions(exerciseId: string): Promise<Record<string, PastSession[]>> {
		return gripSessionsFrom(await this.listWorkouts(), exerciseId);
	}

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

	public async listTemplates(): Promise<Template[]> {
		const templates = await this.live<Template>('template', byRank);

		return templates.map((template) => foldTemplate(template));
	}

	public async getTemplate(id: string): Promise<Template | null> {
		const template = await this.liveOne<Template>(id, 'template');

		return template === null ? null : foldTemplate(template);
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

	// Tombstone, not delete, so the row leaves the server too; run on every open
	// because a device on an old build can push a main variant back.
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

	// null = never rest; clearing an override is `clearRestOverride`, not a write of null.
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

	// A count rather than the records: the Settings row asks after every write and
	// needs the number, not four kinds of payload.
	public async pendingCount(): Promise<number> {
		const records = await this.db.getAll('records');

		return records.filter((record) => record.dirty).length;
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

	public async syncedAt(): Promise<number | null> {
		const value = await this.db.get('meta', SYNCED_KEY);

		return typeof value === 'number' ? value : null;
	}

	public async setSyncedAt(at: number): Promise<void> {
		await this.db.put('meta', at, SYNCED_KEY);
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

	// The watermark and the last-synced stamp are facts about one account's server: the
	// seq count starts over, and this phone has never synced with the arriving account.
	// Held here so the two paths that change hands cannot drift on what to forget.
	private async forgetServerFacts(): Promise<void> {
		await this.setWatermark(0);
		await this.db.delete('meta', SYNCED_KEY);
	}

	// `dirty` is the third such fact, and the one only this path can restore: every
	// record kept across the change is unpushed again, because the arriving account's
	// server has never seen any of them.
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

		await this.forgetServerFacts();
	}

	public async adopt(userId: string): Promise<void> {
		await this.freshenAll();

		await this.db.put('meta', userId, OWNER_KEY);
	}

	// Removing the owner key leaves the store claimable: the next account to sign in
	// here inherits the history, deliberately.
	public async disown(): Promise<void> {
		await this.freshenAll();

		await this.db.delete('meta', OWNER_KEY);
	}

	public async wipe(userId: string | null): Promise<void> {
		await this.db.clear('records');
		await this.clearSnapshot();
		await this.forgetServerFacts();

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
