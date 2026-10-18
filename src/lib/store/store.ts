import { catalog as shipped } from '$lib/catalog';
import type { BodyweightEntry, ChartRange } from '$lib/domain/bodyweight';
import { bodyweightId } from '$lib/domain/bodyweight';
import type {
	Catalog,
	CustomDraft,
	CustomExercisePreference,
	CustomGripPreference,
	PreferenceRow
} from '$lib/domain/custom';
import {
	CUSTOM_GRIP_PREFIX,
	customExerciseId,
	customGripId,
	isCustomExercisePreference,
	isCustomGripPreference,
	settleDraft,
	withCustoms
} from '$lib/domain/custom';
import type { ExertionScale } from '$lib/domain/exertion';
import type {
	ExertionScalePreference,
	NotePreference,
	PlanRestPreference,
	PlanOfferPreference,
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
	isPlanRestPreference,
	isPlanOfferPreference,
	isRestDefaultPreference,
	isRestOverridePreference,
	isWeightRangePreference,
	noteId,
	planRestId,
	planRestTemplate,
	planOfferId,
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

import type { KilorepDatabase, StoredRecord } from './db.ts';
import { openDatabase } from './db.ts';
import type { FinishedWorkout, Heaviest, LastGrips, LastNotes, LastPerformed } from './derive.ts';
import {
	frequentFrom,
	heaviestFrom,
	historyFrom,
	lastGripsFrom,
	lastNotesFrom,
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
	name?: string;
};

export type RestState = {
	rest: RestSnapshot | null;
	muted: boolean;
	dismissed: RestSnapshot | null;
};

export type Snapshot = RestState & {
	workout: Workout;
	activeSetId: string | null;
};

export type StoreContents = {
	records: WireRecord[];
	session: unknown;
};

// `kept` counts local records, tombstones included, that were as new or newer.
export type ImportOutcome = {
	written: number;
	kept: number;
	session: 'restored' | 'kept' | 'none';
};

const WATERMARK_KEY = 'watermark';
const SNAPSHOT_KEY = 'active-session';
const OWNER_KEY = 'owner';
const SYNCED_KEY = 'syncedAt';

type LegacySnapshot = Omit<Snapshot, keyof RestState> & Partial<RestState>;

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
		typeof value.exerciseId === 'string' &&
		(!('name' in value) || typeof value.name === 'string')
	);
}

// The rest state postdates existing snapshots; normalise rather than reject so an upgrade
// mid-session keeps the half-logged workout.
function settleSnapshot(value: LegacySnapshot): Snapshot {
	return {
		// Folded like every other read: a session in flight when the app upgraded is the one
		// place a retired slug can reach the screen, and the screen has no entry for it.
		workout: foldWorkout(value.workout),
		activeSetId: value.activeSetId,
		rest: isRestSnapshot(value.rest) ? value.rest : null,
		muted: value.muted === true,
		dismissed: isRestSnapshot(value.dismissed) ? value.dismissed : null
	};
}

function wireOf({ id, kind, updatedAt, deletedAt, payload }: StoredRecord): WireRecord {
	return { id, kind, updatedAt, deletedAt, payload };
}

function settledPlanRest({ seconds }: PlanRestPreference): number | null {
	return seconds === null ? null : settleRestSeconds(seconds);
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

	// The newest session that ran this plan, or the newest of all without one.
	public async latestWorkout(templateId?: string): Promise<FinishedWorkout | null> {
		const workouts = await this.listWorkouts();

		return (
			workouts.findLast(
				(workout) => templateId === undefined || workout.templateId === templateId
			) ?? null
		);
	}

	public async history(): Promise<History> {
		const [workouts, { byId }] = await Promise.all([this.listWorkouts(), this.catalog()]);

		return historyFrom(workouts, byId);
	}

	public async lastPerformed(): Promise<LastPerformed> {
		const [workouts, { byId }] = await Promise.all([this.listWorkouts(), this.catalog()]);

		return lastPerformedFrom(workouts, byId);
	}

	public async pickerData(): Promise<{
		lastPerformed: LastPerformed;
		heaviest: Heaviest;
		frequent: string[];
		history: History;
		grips: LastGrips;
		notes: LastNotes;
	}> {
		const [workouts, { byId }] = await Promise.all([this.listWorkouts(), this.catalog()]);

		return {
			lastPerformed: lastPerformedFrom(workouts, byId),
			heaviest: heaviestFrom(workouts, byId),
			frequent: frequentFrom(workouts, byId),
			history: historyFrom(workouts, byId),
			grips: lastGripsFrom(workouts),
			notes: lastNotesFrom(workouts)
		};
	}

	public async ledgerData(): Promise<{ lastPerformed: LastPerformed; heaviest: Heaviest }> {
		const [workouts, { byId }] = await Promise.all([this.listWorkouts(), this.catalog()]);

		return {
			lastPerformed: lastPerformedFrom(workouts, byId),
			heaviest: heaviestFrom(workouts, byId)
		};
	}

	public async pastSessions(exerciseId: string): Promise<PastSession[]> {
		const [workouts, { byId }] = await Promise.all([this.listWorkouts(), this.catalog()]);

		return pastSessionsFrom(workouts, exerciseId, byId);
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

		// An absent id is a plan being born; a tombstoned one is never revived by an edit.
		const tx = this.db.transaction('records', 'readwrite');
		const record = await tx.store.get(template.id);

		if (record === undefined || record.kind !== 'template' || record.deletedAt === null) {
			await tx.store.put({
				id: template.id,
				kind: 'template',
				updatedAt,
				deletedAt: null,
				payload,
				dirty: true
			});
		}

		await tx.done;
	}

	public async listTemplates(): Promise<Template[]> {
		const templates = await this.live<Template>('template', byRank);

		return templates.map((template) => foldTemplate(template));
	}

	public async getTemplate(id: string): Promise<Template | null> {
		const template = await this.liveOne<Template>(id, 'template');

		return template === null ? null : foldTemplate(template);
	}

	public async templateWrittenAt(id: string): Promise<number | null> {
		const record = await this.db.get('records', id);

		return record === undefined || record.kind !== 'template' || record.deletedAt !== null
			? null
			: record.updatedAt;
	}

	public async deleteTemplate(id: string, deletedAt: number): Promise<void> {
		await this.tombstone(id, 'template', deletedAt);
	}

	public async templateDeleted(id: string): Promise<boolean> {
		const record = await this.db.get('records', id);

		return record !== undefined && record.kind === 'template' && record.deletedAt !== null;
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

	/** A plan's own default rest: a number, `null` for never, `undefined` where it has none. */
	public async planRest(templateId: string): Promise<number | null | undefined> {
		const payload = await this.liveOne<unknown>(planRestId(templateId), 'preference');

		return isPlanRestPreference(payload) ? settledPlanRest(payload) : undefined;
	}

	public async planRests(): Promise<Record<string, number | null>> {
		const records = await this.db.getAllFromIndex('records', 'kind', 'preference');
		const rests: Record<string, number | null> = {};

		for (const record of records.filter((live) => live.deletedAt === null)) {
			const templateId = planRestTemplate(record.id);

			if (templateId !== null && isPlanRestPreference(record.payload)) {
				rests[templateId] = settledPlanRest(record.payload);
			}
		}

		return rests;
	}

	public async setPlanRest(
		templateId: string,
		seconds: number | null,
		updatedAt: number
	): Promise<void> {
		const payload: PlanRestPreference = { seconds: settledPlanRest({ seconds }) };

		await this.write(planRestId(templateId), 'preference', updatedAt, payload);
	}

	public async clearPlanRest(templateId: string, deletedAt: number): Promise<void> {
		await this.tombstone(planRestId(templateId), 'preference', deletedAt);
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

	public async answeredOffer(templateId: string | null): Promise<string | null> {
		const payload = await this.liveOne<unknown>(planOfferId(templateId), 'preference');

		return isPlanOfferPreference(payload) ? payload.workoutId : null;
	}

	public async answerOffer(
		templateId: string | null,
		workoutId: string,
		updatedAt: number
	): Promise<void> {
		const payload: PlanOfferPreference = { workoutId };

		await this.write(planOfferId(templateId), 'preference', updatedAt, payload);
	}

	private async preferenceRows(): Promise<PreferenceRow[]> {
		const records = await this.db.getAllFromIndex('records', 'kind', 'preference');

		return records
			.filter((record) => record.deletedAt === null)
			.map(({ id, payload }) => ({ id, payload }));
	}

	public async catalog(): Promise<Catalog> {
		return withCustoms(shipped, await this.preferenceRows());
	}

	// Read-modify-write, as a plan is: an edit never revives a custom deleted on another device.
	private async writeCustom(
		id: string,
		updatedAt: number,
		change: (stored: CustomExercisePreference | null) => CustomExercisePreference | null
	): Promise<void> {
		const tx = this.db.transaction('records', 'readwrite');
		const record = await tx.store.get(id);

		if (record === undefined || (record.kind === 'preference' && record.deletedAt === null)) {
			const stored =
				record !== undefined && isCustomExercisePreference(record.payload) ? record.payload : null;
			const payload = change(stored);

			if (payload !== null) {
				await tx.store.put({
					id,
					kind: 'preference',
					updatedAt,
					deletedAt: null,
					payload,
					dirty: true
				});
			}
		}

		await tx.done;
	}

	public async saveCustomExercise(
		exerciseId: string,
		draft: CustomDraft,
		updatedAt: number
	): Promise<void> {
		await this.writeCustom(customExerciseId(exerciseId), updatedAt, (stored) =>
			Object.assign(settleDraft(draft), {
				archivedAt: stored === null ? null : (stored.archivedAt ?? null)
			})
		);
	}

	/** Out of every list, still named by the history and the plans that hold it. */
	public async archiveCustomExercise(
		exerciseId: string,
		archivedAt: number | null,
		updatedAt: number
	): Promise<void> {
		await this.writeCustom(customExerciseId(exerciseId), updatedAt, (stored) =>
			stored === null ? null : Object.assign(stored, { archivedAt })
		);
	}

	/** Gone for good, its grips with it: only for a custom nothing names. */
	public async deleteCustomExercise(exerciseId: string, deletedAt: number): Promise<void> {
		const rows = await this.preferenceRows();
		const grips = rows.filter(
			({ id, payload }) =>
				id.startsWith(CUSTOM_GRIP_PREFIX) &&
				isCustomGripPreference(payload) &&
				payload.exerciseId === exerciseId
		);

		await this.tombstone(customExerciseId(exerciseId), 'preference', deletedAt);

		for (const grip of grips) {
			await this.tombstone(grip.id, 'preference', deletedAt);
		}
	}

	public async saveCustomGrip(
		gripId: string,
		grip: CustomGripPreference,
		updatedAt: number
	): Promise<void> {
		const payload: CustomGripPreference = {
			exerciseId: grip.exerciseId,
			label: grip.label.trim(),
			createdAt: grip.createdAt
		};

		await this.write(customGripId(gripId), 'preference', updatedAt, payload);
	}

	// Read-modify-write: a rename keeps the grip's place on the axis and never revives a deleted one.
	public async renameCustomGrip(gripId: string, label: string, updatedAt: number): Promise<void> {
		const tx = this.db.transaction('records', 'readwrite');
		const record = await tx.store.get(customGripId(gripId));

		if (
			record !== undefined &&
			record.deletedAt === null &&
			isCustomGripPreference(record.payload)
		) {
			record.payload = Object.assign(record.payload, { label: label.trim() });
			record.updatedAt = updatedAt;
			record.dirty = true;
			await tx.store.put(record);
		}

		await tx.done;
	}

	public async deleteCustomGrip(gripId: string, deletedAt: number): Promise<void> {
		await this.tombstone(customGripId(gripId), 'preference', deletedAt);
	}

	/** Whether a finished session, a plan or the session in progress names this exercise. */
	public async exerciseInUse(exerciseId: string): Promise<boolean> {
		const [workouts, templates, snapshot] = await Promise.all([
			this.listWorkouts(),
			this.listTemplates(),
			this.loadSnapshot()
		]);

		const trees: { entries: { exercises: { exerciseId: string }[] }[] }[] = [
			...workouts,
			...templates,
			...(snapshot === null ? [] : [snapshot.workout])
		];

		return trees
			.flatMap((tree) => tree.entries)
			.flatMap((entry) => entry.exercises)
			.some((exercise) => exercise.exerciseId === exerciseId);
	}

	public async saveSnapshot(snapshot: Snapshot): Promise<void> {
		await this.db.put('meta', snapshot, SNAPSHOT_KEY);
	}

	public async saveRest(state: RestState): Promise<void> {
		const tx = this.db.transaction('meta', 'readwrite');
		const value = await tx.store.get(SNAPSHOT_KEY);

		if (isSnapshot(value)) {
			const { rest, muted, dismissed } = state;

			await tx.store.put(
				Object.assign(settleSnapshot(value), { rest, muted, dismissed }),
				SNAPSHOT_KEY
			);
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

	// As stored, never folded: a backup restores what was written, not what the screen reads.
	public async exportContents(): Promise<StoreContents> {
		const tx = this.db.transaction(['records', 'meta'], 'readonly');
		const records = await tx.objectStore('records').getAll();
		const session = await tx.objectStore('meta').get(SNAPSHOT_KEY);

		await tx.done;

		return {
			records: records
				.filter((record) => record.deletedAt === null)
				.map((record) => wireOf(record)),
			session: isSnapshot(session) ? session : null
		};
	}

	// A tie keeps the local record, as the server decides a push.
	public async importContents(
		contents: StoreContents,
		now: number,
		// A session open in memory has no snapshot until its first exercise.
		sessionOpen = false
	): Promise<ImportOutcome> {
		const tx = this.db.transaction(['records', 'meta'], 'readwrite');
		const records = tx.objectStore('records');
		const meta = tx.objectStore('meta');

		let written = 0;

		for (const record of contents.records) {
			const local = await records.get(record.id);

			if (local !== undefined && record.updatedAt <= local.updatedAt) {
				continue;
			}

			await records.put({
				id: record.id,
				kind: record.kind,
				updatedAt: record.updatedAt,
				deletedAt: record.deletedAt,
				payload: record.payload,
				dirty: true
			});
			written += 1;
		}

		let session: ImportOutcome['session'] = 'none';

		if (isSnapshot(contents.session)) {
			const finished = await records.get(contents.session.workout.id);
			const running = sessionOpen || isSnapshot(await meta.get(SNAPSHOT_KEY));

			if (finished === undefined && !running) {
				await meta.put(contents.session, SNAPSHOT_KEY);
				session = 'restored';
			} else {
				session = 'kept';
			}
		}

		await tx.done;

		await this.dropMainVariants(now);

		return { written, kept: contents.records.length - written, session };
	}

	public async dirtyRecords(): Promise<WireRecord[]> {
		const records = await this.db.getAll('records');

		return records.filter((record) => record.dirty).map((record) => wireOf(record));
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
