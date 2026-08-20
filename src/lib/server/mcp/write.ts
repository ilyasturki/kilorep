import type { RecordKind, WireRecord } from '$lib/sync/protocol';

import type { Database } from '../db/client.ts';
import { applyPush, rowFor } from '../db/sync.ts';

/**
 * What the caller believes it is writing over.
 *
 * `absent` creates, a number edits the exact version it read, and `any` overwrites
 * whatever is there — which only body weight gets, because re-logging a day is the
 * documented behaviour there rather than a lost update.
 */
export type Expectation = 'absent' | 'any' | number;

export type WriteRequest = {
	id: string;
	kind: RecordKind;
	payload: unknown;
	expect: Expectation;
	/** Tombstone rather than store — the payload is kept so a pull can still name what went. */
	deleted?: boolean;
};

export type WriteOutcome =
	/** `previous` is the payload this write displaced, or null where it created one. */
	| { ok: true; updatedAt: number; previous: unknown }
	| { ok: false; reason: string; storedUpdatedAt: number | null };

function refuse(reason: string, storedUpdatedAt: number | null): WriteOutcome {
	return { ok: false, reason, storedUpdatedAt };
}

/**
 * One guarded write into a user's records.
 *
 * `/api/sync` resolves a conflict by taking the higher `updatedAt` and never asks whether
 * the writer had seen what it replaced — which is the right trade for two of the lifter's
 * own devices, and the wrong one for an assistant editing history it read a minute ago.
 * So MCP states what it expects to find and is refused when the record has moved since.
 *
 * The stamp is pushed past the stored one where a device's clock ran ahead of the server's:
 * the precondition already proved this caller is editing the version that is actually there,
 * so losing the write to a future timestamp would be a silent no-op rather than safety.
 */
export function writeRecord(db: Database, userId: string, request: WriteRequest): WriteOutcome {
	return db.transaction((tx) => {
		const existing = rowFor(tx, userId, request.id);
		const live = existing !== undefined && existing.deletedAt === null;
		const storedUpdatedAt = existing === undefined ? null : existing.updatedAt;

		if (request.expect === 'absent' && live) {
			return refuse(`${request.kind} ${request.id} already exists`, storedUpdatedAt);
		}

		if (typeof request.expect === 'number') {
			if (!live) {
				return refuse(`no such ${request.kind}: ${request.id}`, storedUpdatedAt);
			}

			if (existing.updatedAt !== request.expect) {
				return refuse(
					`${request.kind} ${request.id} changed since you read it — read it again and retry`,
					storedUpdatedAt
				);
			}
		}

		const floor = existing === undefined ? 0 : existing.updatedAt;
		const updatedAt = Math.max(Date.now(), floor + 1);

		const record: WireRecord = {
			id: request.id,
			kind: request.kind,
			updatedAt,
			deletedAt: request.deleted === true ? updatedAt : null,
			payload: request.payload
		};

		const { stored } = applyPush(tx, userId, record);

		if (!stored) {
			return refuse('the write was refused', storedUpdatedAt);
		}

		// Read inside the transaction rather than from a cached view: a caller that overwrites
		// deserves to be told what it overwrote, and to be told it exactly.
		return { ok: true, updatedAt, previous: live ? existing.payload : null };
	});
}
