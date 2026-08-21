import { ApiError, NO_SERVER, request } from '$lib/api/client';
import type { Store } from '$lib/store/store';
import { getStore } from '$lib/store/store';

import type { SyncResponse } from './protocol.ts';
import { MAX_PUSH } from './protocol.ts';
import type { SyncStall } from './status.ts';
import { healsItself, report, syncStatus } from './status.ts';

const DEBOUNCE_MS = 3000;

// A server that did not answer is tried again on this ladder, then every five minutes.
// The first rungs are short because the common case is a phone walking out of a
// basement gym; the cap sits well inside a session, so a network that returns mid-
// workout still lands the session before it.
const BACKOFF_MS = [5000, 15_000, 45_000, 120_000, 300_000];

const ROUNDS = 10;

// 401 earns its own name: `request` drops the device token on the way past, so every
// attempt after it fails identically until somebody signs in. Nothing retries that.
function stallFor(status: number): SyncStall {
	if (status === NO_SERVER) {
		return 'no-server';
	}

	if (status === 401) {
		return 'signed-out';
	}

	return 'unreachable';
}

async function exchangeOnce(store: Store, userId: string): Promise<SyncStall | null> {
	if (!(await store.claimOwner(userId))) {
		return 'other-account';
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
		if (error instanceof ApiError) {
			return stallFor(error.status);
		}

		throw error;
	}

	await store.applyRemote(response.records);
	await store.acknowledge(response.acks);
	await store.setWatermark(response.watermark);

	return null;
}

// Exhausting the rounds is not a fault: each one pushed its `MAX_PUSH` and had them
// acked, so this is a large backlog moving rather than a stall. It returns clean and
// the caller, seeing records still pending, comes straight back for the rest.
async function rounds(store: Store, userId: string): Promise<Attempt> {
	for (let round = 0; round < ROUNDS; round += 1) {
		const stall = await exchangeOnce(store, userId);

		if (stall !== null) {
			return { stall, pending: null };
		}

		// The count, not the records: this asks whether to go round again, and building
		// the push payload to answer it would be the second of three scans per pass.
		const pending = await store.pendingCount();

		if (pending === 0) {
			return { stall: null, pending };
		}
	}

	return { stall: null, pending: null };
}

// What one pass came back with, and the count it already paid for: `settle` takes the
// number rather than scanning for it again, which is the third scan gone.
type Attempt = { stall: SyncStall | null; pending: number | null };

async function settle(store: Store, { stall, pending }: Attempt): Promise<void> {
	// Tolerated, not guarded: a store that cannot be counted still has a stall worth
	// reporting, and the last known number is a better answer than none.
	const counted = pending ?? (await store.pendingCount().catch(() => syncStatus().pending));

	if (stall !== null) {
		report({ pending: counted, stall, busy: false });

		return;
	}

	const at = Date.now();

	await store.setSyncedAt(at);

	report({ pending: counted, syncedAt: at, stall: null, busy: false });
}

/**
 * One attempt, start to finish. Never throws, and never schedules another.
 *
 * `syncPromptly` is what the app calls; this stays exported because it is the whole
 * exchange with nothing around it, which is the thing worth testing.
 */
export async function syncNow(userId: string, target?: Store): Promise<SyncStall | null> {
	report({ busy: true });

	let store: Store;

	try {
		store = target ?? (await getStore());
	} catch {
		// The device database itself is unavailable: there is no state to report from,
		// and nothing here can act on it.
		report({ busy: false });

		return 'unreachable';
	}

	try {
		const pass = await rounds(store, userId);

		await settle(store, pass);

		return pass.stall;
	} catch {
		// A fault mid-exchange rather than a refusal: the records are still dirty and
		// another attempt is the answer, so it reads as an unanswered server. Settling a
		// stall touches nothing that can throw, so this needs no guard of its own.
		await settle(store, { stall: 'unreachable', pending: null });

		return 'unreachable';
	}
}

let debounce: ReturnType<typeof setTimeout> | undefined;
let retry: ReturnType<typeof setTimeout> | undefined;
let attempt = 0;
let inFlight = false;
let again = false;

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

	const { pending, stall } = syncStatus();

	clearTimeout(retry);

	if (pending === 0 || !healsItself(stall)) {
		attempt = 0;

		return;
	}

	// A clean pass that still leaves records is a backlog draining, not a dead network:
	// start the ladder over rather than climbing one built for a server that is gone.
	if (stall === null) {
		attempt = 0;
	}

	const wait = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];

	attempt += 1;

	retry = setTimeout(() => {
		void drain(userId);
	}, wait);
}

/** The count and the stamp the Settings row draws, without going near the network. */
export async function readSyncState(target?: Store): Promise<void> {
	try {
		const store = target ?? (await getStore());

		// Two stores, neither waiting on the other.
		const [pending, syncedAt] = await Promise.all([store.pendingCount(), store.syncedAt()]);

		report({ pending, syncedAt });
	} catch {
		/* empty */
	}
}

/** After a write. Debounced, because a burst of edits is one exchange. */
export function syncSoon(userId: string): void {
	clearTimeout(debounce);

	// Ahead of the debounce, so the row counts the write now rather than in three
	// seconds — by then the phone is usually back in a pocket.
	void readSyncState();

	debounce = setTimeout(() => {
		void drain(userId);
	}, DEBOUNCE_MS);
}

// Everything a pending exchange is holding: both timers, the rung the ladder had
// reached, and the re-run a call arriving mid-flight asked for.
function clearSchedule(): void {
	clearTimeout(debounce);
	clearTimeout(retry);
	attempt = 0;
	again = false;
}

/** Straight at it, skipping both the debounce and the ladder: a launch, a returning
 * network, a foregrounded app, a tap. */
export function syncPromptly(userId: string): void {
	clearSchedule();

	void drain(userId);
}

/**
 * Drop everything scheduled.
 *
 * Runs when the account leaves — the layout re-wires its triggers with a null id, which
 * lands here. A debounced or laddered sync firing afterwards would carry the departing
 * account's id into `claimOwner`, which re-stamps a disowned store as theirs.
 */
export function stopSyncing(): void {
	clearSchedule();
}
