/**
 * The server's half of the sync protocol: one round trip, one transaction.
 *
 * Push resolves last-write-wins per record by client-authored `updatedAt`;
 * pull is everything past the client's watermark, ordered by the seqs this
 * server claimed. The two halves share the transaction so a pull can never
 * observe half a push — and so a crash rolls back seq claims together with
 * the writes they stamp, per the `claimSeq` contract.
 */

import { and, eq, gt } from 'drizzle-orm';

import type { SyncAck, SyncRequest, SyncResponse, WireRecord } from '$lib/sync/protocol';

import type { Database } from './client.ts';
import type { RecordRow } from './schema.ts';
import { records } from './schema.ts';
import type { Executor } from './seq.ts';
import { claimSeq } from './seq.ts';

/**
 * A row as the wire carries it. `seq` and `userId` stay behind: the first is
 * the server's ordering detail (the client only ever sees it aggregated into
 * the watermark), and the second is the tenant boundary itself.
 */
function wireOf({ id, kind, updatedAt, deletedAt, payload }: RecordRow): WireRecord {
	return { id, kind, updatedAt, deletedAt, payload };
}

/**
 * Whether `pushed` beats what the server holds. Strictly newer, so a tie —
 * which is the same edit pushed twice — is superseded rather than rewritten,
 * and a replayed request claims no second seq.
 */
function wins(pushed: WireRecord, existing: RecordRow | undefined): boolean {
	return existing === undefined || pushed.updatedAt > existing.updatedAt;
}

function upsert(tx: Executor, userId: string, seq: number, pushed: WireRecord): void {
	// One object for both halves, as `scripts/seed.ts` writes it: `set` then also
	// assigns the conflict-target columns, to the values they already hold.
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

/**
 * Runs one sync round trip for `userId`. The request is trusted here — shape
 * validation is the endpoint's job, tenancy is the caller passing a
 * credentialled user id — and everything happens inside a single transaction.
 *
 * What the response's `records` hold is `SyncResponse`'s contract.
 */
export function syncExchange(db: Database, userId: string, request: SyncRequest): SyncResponse {
	return db.transaction((tx) => {
		const acks: SyncAck[] = [];
		const accepted = new Set<string>();
		// Keyed by id so a lost push whose winning row *also* sits past the
		// watermark arrives once, not once per reason.
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

		// After the pushes on purpose: the rows they wrote sit past the client's
		// watermark too, and counting their seqs here is what lets the response
		// watermark cover them without a second query.
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
