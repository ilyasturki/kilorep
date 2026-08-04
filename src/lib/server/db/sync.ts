import { and, eq, gt } from 'drizzle-orm';

import type { SyncAck, SyncRequest, SyncResponse, WireRecord } from '$lib/sync/protocol';

import type { Database } from './client.ts';
import type { RecordRow } from './schema.ts';
import { records } from './schema.ts';
import type { Executor } from './seq.ts';
import { claimSeq } from './seq.ts';

function wireOf({ id, kind, updatedAt, deletedAt, payload }: RecordRow): WireRecord {
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

export function syncExchange(db: Database, userId: string, request: SyncRequest): SyncResponse {
	return db.transaction((tx) => {
		const acks: SyncAck[] = [];
		const accepted = new Set<string>();
		const out = new Map<string, WireRecord>();

		for (const pushed of request.push) {
			const existing = tx
				.select()
				.from(records)
				.where(and(eq(records.userId, userId), eq(records.id, pushed.id)))
				.get();

			if (wins(pushed, existing)) {
				upsert(tx, userId, claimSeq(tx, userId), pushed);
				acks.push({ id: pushed.id, updatedAt: pushed.updatedAt });
				accepted.add(pushed.id);
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

			if (!accepted.has(row.id)) {
				out.set(row.id, wireOf(row));
			}
		}

		return { acks, records: [...out.values()], watermark };
	});
}
