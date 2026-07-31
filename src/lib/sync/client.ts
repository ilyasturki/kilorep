/**
 * The client's half of the sync protocol: opportunistic, silent, dumb on
 * purpose. It runs on launch and shortly after writes, pushes whatever is
 * dirty, applies whatever comes back, and treats every failure as "not now" —
 * the records stay dirty and the next trigger retries. PRODUCT.md hard rule 7
 * reaches even here: no spinner, no status, nothing for a lifter to wait on.
 *
 * Framework-free like the rest of this layer; `$lib/api/client` follows the
 * same rule, so the whole path from store to wire imports no framework.
 */

import { ApiError, request } from '$lib/api/client';
import type { Store } from '$lib/store/store';
import { getStore } from '$lib/store/store';

import type { SyncResponse } from './protocol.ts';
import { MAX_PUSH } from './protocol.ts';

/**
 * How long a write-triggered sync waits for further writes. Long enough to
 * batch finishing a workout with anything logged right after; short enough
 * that the phone is usually still awake and on the gym's network.
 */
const DEBOUNCE_MS = 3000;

/**
 * One round trip. True when the exchange happened; false when it could not —
 * no server, offline, refused, or a store owned by a different account. The
 * callers are fire-and-forget triggers, so the return value exists for tests
 * and for the loop below, not for UI.
 */
async function exchangeOnce(store: Store, userId: string): Promise<boolean> {
	// The one thing sync must never do is mix accounts: a store that has synced
	// as one user refuses to sync as another. See `claimOwner`.
	if (!(await store.claimOwner(userId))) {
		return false;
	}

	const dirty = await store.dirtyRecords();
	const body = {
		watermark: await store.watermark(),
		push: dirty.slice(0, MAX_PUSH)
	};

	let response: SyncResponse;

	try {
		response = await request<SyncResponse>('/api/sync', { method: 'POST', body });
	} catch (error) {
		// Every ApiError is a "not now": NO_SERVER is the standalone phone,
		// OFFLINE is the gym basement, 401 is a session the layout guard will
		// deal with, 4xx/5xx is a server that will be looked at. Nothing here
		// can act on any of them, and the dirty flags already hold the retry.
		if (error instanceof ApiError) {
			return false;
		}

		throw error;
	}

	await store.applyRemote(response.records);
	await store.acknowledge(response.acks);
	await store.setWatermark(response.watermark);

	return true;
}

/**
 * A full sync: exchanges until nothing dirty is left over the push cap.
 * Bounded, because "keep going while there is progress" must not become a
 * spin against a server that keeps refusing the same record.
 *
 * Never throws. Every caller is a fire-and-forget trigger with nowhere to put
 * an error — the dirty flags already hold the retry, and the one failure that
 * is not the network's (a broken IndexedDB) will resurface on the next
 * foreground read, where a screen can actually say so.
 */
export async function syncNow(userId: string, target?: Store): Promise<void> {
	try {
		// `target` exists for tests, which need isolated stores; the app always
		// syncs the one device database.
		const store = target ?? (await getStore());

		// Ten round trips is 5000 records — not a real session, so hitting the
		// bound means something is wrong and stopping is the right answer.
		for (let round = 0; round < 10; round += 1) {
			if (!(await exchangeOnce(store, userId))) {
				return;
			}

			const remaining = await store.dirtyRecords();

			if (remaining.length === 0) {
				return;
			}
		}
	} catch {
		// Swallowed with intent — see the doc comment.
	}
}

let timer: ReturnType<typeof setTimeout> | undefined;
let inFlight = false;
let again = false;

/** `syncNow`, serialized: one exchange in the air, a follow-up if asked meanwhile. */
async function drain(userId: string): Promise<void> {
	if (inFlight) {
		again = true;

		return;
	}

	inFlight = true;

	try {
		do {
			again = false;
			await syncNow(userId);
		} while (again);
	} finally {
		inFlight = false;
	}
}

/**
 * The after-a-write trigger: debounced, coalesced, silent. Call it and walk
 * away — that is its entire contract. `drain` cannot reject because `syncNow`
 * cannot, so the dangling promise is genuinely fire-and-forget.
 */
export function syncSoon(userId: string): void {
	clearTimeout(timer);

	timer = setTimeout(() => {
		void drain(userId);
	}, DEBOUNCE_MS);
}
