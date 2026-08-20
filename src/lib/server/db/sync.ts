import { and, eq, gt } from 'drizzle-orm';

import type { SyncAck, SyncRequest, SyncResponse, WireRecord } from '$lib/sync/protocol';

import type { Database } from './client.ts';
import type { RecordRow } from './schema.ts';
import { records } from './schema.ts';
import type { Executor } from './seq.ts';
import { claimSeq } from './seq.ts';

export function wireOf({ id, kind, updatedAt, deletedAt, payload }: RecordRow): WireRecord {
	return { id, kind, updatedAt, deletedAt, payload };
}

function wins(pushed: WireRecord, existing: RecordRow | undefined): boolean {
	return existing === undefined || pushed.updatedAt > existing.updatedAt;
}

function upsert(tx: Executor, userId: string, seq: number, pushed: WireRecord): void {
	const values = {
		userId,
		id: pushed.id,
		kind: pushed.kind,
		seq,
		updatedAt: pushed.updatedAt,
		deletedAt: pushed.deletedAt,
		payload: pushed.payload
	};

	tx.insert(records)
		.values(values)
		.onConflictDoUpdate({ target: [records.userId, records.id], set: values })
		.run();
}

export function rowFor(tx: Executor, userId: string, id: string): RecordRow | undefined {
	return tx
		.select()
		.from(records)
		.where(and(eq(records.userId, userId), eq(records.id, id)))
		.get();
}

export type PushOutcome = { stored: boolean; existing: RecordRow | undefined };

/**
 * One record through the last-write-wins gate, stamped with a fresh seq when it takes.
 *
 * Every write into a user's records goes through here — a device push and an MCP call
 * alike — so the rule that decides a conflict has one home rather than two that drift.
 */
export function applyPush(tx: Executor, userId: string, pushed: WireRecord): PushOutcome {
	const existing = rowFor(tx, userId, pushed.id);

	if (!wins(pushed, existing)) {
		return { stored: false, existing };
	}

	upsert(tx, userId, claimSeq(tx, userId), pushed);

	return { stored: true, existing };
}

export function syncExchange(db: Database, userId: string, request: SyncRequest): SyncResponse {
	return db.transaction((tx) => {
		const acks: SyncAck[] = [];
		const taken = new Set<string>();
		const out = new Map<string, WireRecord>();

		for (const pushed of request.push) {
			const { stored, existing } = applyPush(tx, userId, pushed);

			if (stored) {
				acks.push({ id: pushed.id, updatedAt: pushed.updatedAt });
				taken.add(pushed.id);
			} else if (existing !== undefined) {
				out.set(existing.id, wireOf(existing));
			}
		}

		const fresh = tx
			.select()
			.from(records)
			.where(and(eq(records.userId, userId), gt(records.seq, request.watermark)))
			.orderBy(records.seq)
			.all();

		let watermark = request.watermark;

		for (const row of fresh) {
			watermark = row.seq;

			if (!taken.has(row.id)) {
				out.set(row.id, wireOf(row));
			}
		}

		return { acks, records: [...out.values()], watermark };
	});
}
