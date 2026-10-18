import { bodyweightId, localDateOf } from '$lib/domain/bodyweight';
import { CUSTOM_EXERCISE_PREFIX, CUSTOM_GRIP_PREFIX } from '$lib/domain/custom';
import type { StoreContents } from '$lib/store/store';
import type { RecordKind, WireRecord } from '$lib/sync/protocol';
import { isShape, isWireRecord } from '$lib/sync/protocol';

const BACKUP_KIND = 'kilorep-backup';

// Bump when a reader of this version would misread the file; older files keep importing.
export const BACKUP_FORMAT = 1;

export type Backup = StoreContents & {
	kind: typeof BACKUP_KIND;
	format: number;
	appVersion: string;
	exportedAt: string;
};

// A custom exercise or grip is a preference record on disk and counted apart from the settings.
export type BackupSummary = Record<RecordKind, number> & {
	exercises: number;
	grips: number;
	session: boolean;
	from: string | null;
	to: string | null;
};

export type Refusal = 'not-backup' | 'newer' | 'damaged' | 'empty';

export type BackupRead =
	{ ok: true; contents: StoreContents; summary: BackupSummary } | { ok: false; reason: Refusal };

export const REFUSALS: Record<Refusal, string> = {
	'not-backup': 'This file is not a Kilorep backup.',
	newer:
		'This backup was made by a newer version of Kilorep. Update the app, then import it again.',
	damaged: 'This backup is damaged. Nothing was imported.',
	empty: 'This backup holds nothing to import.'
};

export function backupOf(contents: StoreContents, now: number): Backup {
	return {
		kind: BACKUP_KIND,
		format: BACKUP_FORMAT,
		appVersion: import.meta.env.APP_VERSION,
		exportedAt: new Date(now).toISOString(),
		records: contents.records,
		session: contents.session
	};
}

export function backupName(now: number): string {
	return `kilorep-${localDateOf(new Date(now))}.json`;
}

type Check = (value: unknown) => boolean;

const isText: Check = (value) => typeof value === 'string';

const isTime: Check = (value) => typeof value === 'number' && Number.isFinite(value);

// 8.64e15 ms is the widest instant a Date can hold; past it every date reads as Invalid Date.
const isMoment: Check = (value) => isTime(value) && Math.abs(Number(value)) <= 8.64e15;

const isLocalDate: Check = (value) =>
	isText(value) && /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/u.test(String(value));

// Absent passes: a field a reader can do without is one an older build may never have written.
const isCount: Check = (value) => value === undefined || value === null || isTime(value);

const isTextOrNull: Check = (value) => value === null || isText(value);

function isListOf(value: unknown, check: Check): boolean {
	return Array.isArray(value) && value.every((item) => check(item));
}

const isWorkoutSet: Check = (value) =>
	isShape(value) &&
	isText(value.id) &&
	(value.type === undefined || isText(value.type)) &&
	isCount(value.plannedReps) &&
	isCount(value.weight) &&
	isCount(value.reps) &&
	isCount(value.rpe) &&
	(value.completed === undefined || typeof value.completed === 'boolean');

const isTemplateSet: Check = (value) =>
	isShape(value) && isText(value.id) && isCount(value.plannedReps);

function isTree(value: unknown, isSet: Check): boolean {
	const isLeg: Check = (leg) =>
		isShape(leg) && isText(leg.id) && isText(leg.exerciseId) && isListOf(leg.sets, isSet);

	return isListOf(
		value,
		(entry) => isShape(entry) && isText(entry.id) && isListOf(entry.exercises, isLeg)
	);
}

function isWorkout(value: unknown): value is Record<string, unknown> & { id: string } {
	return (
		isShape(value) &&
		isText(value.id) &&
		(value.templateId === undefined || isTextOrNull(value.templateId)) &&
		isMoment(value.startedAt) &&
		isTree(value.entries, isWorkoutSet)
	);
}

const isPayloadOf: Record<RecordKind, (record: WireRecord) => boolean> = {
	workout: ({ id, payload }) =>
		isWorkout(payload) && payload.id === id && isCount(payload.finishedAt),
	template: ({ id, payload }) =>
		isShape(payload) &&
		payload.id === id &&
		isText(payload.name) &&
		isCount(payload.createdAt) &&
		isTree(payload.entries, isTemplateSet),
	bodyweight: ({ id, payload }) =>
		isShape(payload) &&
		isLocalDate(payload.date) &&
		id === bodyweightId(String(payload.date)) &&
		isTime(payload.kg),
	preference: ({ payload }) => isShape(payload)
};

function isSession(value: unknown): boolean {
	return isShape(value) && isWorkout(value.workout) && isTextOrNull(value.activeSetId);
}

function summaryOf(contents: StoreContents): BackupSummary {
	const summary: BackupSummary = {
		workout: 0,
		template: 0,
		bodyweight: 0,
		preference: 0,
		exercises: 0,
		grips: 0,
		session: contents.session !== null,
		from: null,
		to: null
	};

	const days: string[] = [];

	for (const { id, kind, payload } of contents.records) {
		if (kind === 'preference' && id.startsWith(CUSTOM_EXERCISE_PREFIX)) {
			summary.exercises += 1;
		} else if (kind === 'preference' && id.startsWith(CUSTOM_GRIP_PREFIX)) {
			summary.grips += 1;
		} else {
			summary[kind] += 1;
		}

		if (kind === 'workout' && isShape(payload)) {
			const started = new Date(Number(payload.startedAt));

			days.push(localDateOf(started));
		} else if (kind === 'bodyweight' && isShape(payload)) {
			days.push(String(payload.date));
		}
	}

	days.sort();

	summary.from = days.at(0) ?? null;
	summary.to = days.at(-1) ?? null;

	return summary;
}

// All or nothing, so a garbled record never lands half a restore; tombstones are left out.
export function readBackup(text: string): BackupRead {
	let parsed: unknown;

	try {
		parsed = JSON.parse(text);
	} catch {
		return { ok: false, reason: 'not-backup' };
	}

	if (!isShape(parsed) || parsed.kind !== BACKUP_KIND) {
		return { ok: false, reason: 'not-backup' };
	}

	if (!Number.isSafeInteger(parsed.format) || Number(parsed.format) < 1) {
		return { ok: false, reason: 'damaged' };
	}

	if (Number(parsed.format) > BACKUP_FORMAT) {
		return { ok: false, reason: 'newer' };
	}

	if (!Array.isArray(parsed.records)) {
		return { ok: false, reason: 'damaged' };
	}

	const records: WireRecord[] = [];

	for (const record of parsed.records) {
		if (!isWireRecord(record)) {
			return { ok: false, reason: 'damaged' };
		}

		if (record.deletedAt !== null) {
			continue;
		}

		if (!isPayloadOf[record.kind](record)) {
			return { ok: false, reason: 'damaged' };
		}

		records.push(record);
	}

	const session = parsed.session ?? null;

	if (session !== null && !isSession(session)) {
		return { ok: false, reason: 'damaged' };
	}

	if (records.length === 0 && session === null) {
		return { ok: false, reason: 'empty' };
	}

	const contents: StoreContents = { records, session };

	return { ok: true, contents, summary: summaryOf(contents) };
}
