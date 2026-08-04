export const RECORD_KINDS = ['workout', 'template', 'bodyweight', 'preference'] as const;

export type RecordKind = (typeof RECORD_KINDS)[number];

export type WireRecord = {
	id: string;
	kind: RecordKind;
	updatedAt: number;
	deletedAt: number | null;
	payload: unknown;
};

export type SyncRequest = {
	watermark: number;
	push: WireRecord[];
};

export type SyncAck = {
	id: string;
	updatedAt: number;
};

export type SyncResponse = {
	acks: SyncAck[];
	records: WireRecord[];
	watermark: number;
};

export const MAX_PUSH = 500;

function isRecordKind(value: unknown): value is RecordKind {
	const kinds: readonly string[] = RECORD_KINDS;

	return typeof value === 'string' && kinds.includes(value);
}

function isShape(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isWireRecord(value: unknown): value is WireRecord {
	return (
		isShape(value) &&
		typeof value.id === 'string' &&
		value.id !== '' &&
		isRecordKind(value.kind) &&
		typeof value.updatedAt === 'number' &&
		Number.isFinite(value.updatedAt) &&
		(value.deletedAt === null ||
			(typeof value.deletedAt === 'number' && Number.isFinite(value.deletedAt))) &&
		'payload' in value &&
		value.payload !== undefined
	);
}
