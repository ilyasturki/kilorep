/**
 * The wire shape of sync, shared by the client that speaks it and the server
 * endpoint that answers it — one module, so the two cannot drift.
 *
 * Plain TypeScript with zero framework imports, per CLAUDE.md hard rule 1.
 * The guards live beside the types because the server reads this shape off an
 * untrusted request body, and a validator kept in a different layer is the
 * kind that stops matching the type it validates.
 */

/**
 * Every kind of record the protocol carries, and nothing else — client store
 * and server table are both kind-agnostic past this point.
 */
export const RECORD_KINDS = ['workout', 'template', 'bodyweight'] as const;

export type RecordKind = (typeof RECORD_KINDS)[number];

/**
 * A record as it crosses the wire, both directions.
 *
 * `updatedAt` is client-authored epoch milliseconds and is what last-write-wins
 * compares. `deletedAt` is the tombstone — a delete syncs as a record like any
 * other, or it resurrects on the next pull. `payload` is opaque to the
 * protocol: the server stores it and hands it back, and only the client store
 * knows what a given kind holds inside.
 */
export type WireRecord = {
	id: string;
	kind: RecordKind;
	updatedAt: number;
	deletedAt: number | null;
	payload: unknown;
};

/**
 * One round trip: everything dirty goes up, everything unseen comes down.
 *
 * `watermark` is the highest server `seq` this client has applied — never a
 * timestamp, because sync order is the server counter's and a device clock in
 * a gym has no say. Zero is the new-device state, and makes the first sync the
 * full pull PRODUCT.md promises.
 */
export type SyncRequest = {
	watermark: number;
	push: WireRecord[];
};

/**
 * A push the server accepted, named by the `updatedAt` it carried. The client
 * clears its dirty flag only when the local record still holds that exact
 * value — an edit made while the request was in flight keeps the flag, and the
 * next sync carries the newer version.
 */
export type SyncAck = {
	id: string;
	updatedAt: number;
};

export type SyncResponse = {
	acks: SyncAck[];
	/**
	 * Records the client has not applied: everything past its watermark, minus
	 * the pushes just accepted (the client already holds those), plus the
	 * server's copy of any push that *lost* last-write-wins — sent even though
	 * its seq may sit below the watermark, because the client just proved it
	 * holds something older and would otherwise keep it forever.
	 */
	records: WireRecord[];
	watermark: number;
};

/** How many records one push may carry. A cap, not a batch size the client aims for. */
export const MAX_PUSH = 500;

function isRecordKind(value: unknown): value is RecordKind {
	// Widened to `readonly string[]` so `includes` accepts any string. The
	// widening is an up-cast — nothing is claimed that the tuple does not hold.
	const kinds: readonly string[] = RECORD_KINDS;

	return typeof value === 'string' && kinds.includes(value);
}

// The same guard `$lib/server/json` names, restated rather than imported:
// this layer is framework-free and portable, and reaching into `server/` for
// three comparisons would tie it to the one artifact that has a server.
function isShape(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Whether an untrusted value is a `WireRecord`. Field by field, no shortcuts:
 * this runs on request bodies, and every hole here is a row the server would
 * store and every other device would then pull.
 *
 * `payload` is deliberately unchecked beyond presence — it is opaque by
 * design, and `undefined` is the one value refused because JSON cannot carry
 * it back out.
 */
export function isWireRecord(value: unknown): value is WireRecord {
	if (!isShape(value)) {
		return false;
	}

	const record = value;

	return (
		typeof record.id === 'string' &&
		record.id !== '' &&
		isRecordKind(record.kind) &&
		typeof record.updatedAt === 'number' &&
		Number.isFinite(record.updatedAt) &&
		(record.deletedAt === null ||
			(typeof record.deletedAt === 'number' && Number.isFinite(record.deletedAt))) &&
		'payload' in record &&
		record.payload !== undefined
	);
}
