/**
 * What sync has to say for itself, and nothing about how it says it.
 *
 * Plain TypeScript with a listener list rather than a rune, because `client.ts` is
 * tested under vitest, which compiles no Svelte. `state.svelte.ts` mirrors this into
 * `$state` for the one row that draws it.
 */

/**
 * Why the last exchange did not settle.
 *
 * `unreachable` heals on its own — the retry, a returning network or the next write
 * clears it. The other three are dead ends: nothing changes until someone signs in,
 * names a server, or settles whose phone this is.
 */
export type SyncStall = 'unreachable' | 'no-server' | 'signed-out' | 'other-account';

export type SyncStatus = {
	pending: number;
	syncedAt: number | null;
	stall: SyncStall | null;
	busy: boolean;
};

// A predicate rather than a boolean: narrowing the argument lets the caller that draws
// the dead ends index a table by them, so a new stall is a compile error there rather
// than a row that silently falls through to the wrong sentence.
export function healsItself(stall: SyncStall | null): stall is null | 'unreachable' {
	return stall === null || stall === 'unreachable';
}

function blank(): SyncStatus {
	return { pending: 0, syncedAt: null, stall: null, busy: false };
}

let current: SyncStatus = blank();

const listeners = new Set<(status: SyncStatus) => void>();

export function syncStatus(): SyncStatus {
	return current;
}

// Field by field: the two nullable ones cannot merge with `??`, which would read a
// deliberate `null` — sync settling, a stall clearing — as "leave it alone". A spread
// would say it in one line, but `oxc/no-rest-spread-properties` is only lifted for
// `.svelte.ts`, and this module is plain TypeScript on purpose.
export function report(patch: Partial<SyncStatus>): void {
	current = {
		pending: patch.pending ?? current.pending,
		syncedAt: patch.syncedAt === undefined ? current.syncedAt : patch.syncedAt,
		stall: patch.stall === undefined ? current.stall : patch.stall,
		busy: patch.busy ?? current.busy
	};

	for (const listener of listeners) {
		listener(current);
	}
}

export function onSyncStatus(listener: (status: SyncStatus) => void): () => void {
	listeners.add(listener);

	listener(current);

	return () => {
		listeners.delete(listener);
	};
}

// Tests only: the module singleton outlives a `beforeEach` otherwise.
export function resetSyncStatus(): void {
	current = blank();
}
