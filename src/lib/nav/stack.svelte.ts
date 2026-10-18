import { addressOf, behindOf, entriesAfter, HISTORY_INDEX, stepOf } from '$lib/nav/entries';

import type { EnterReason, Entries } from '$lib/nav/entries';

const KEY = 'kilorep:entries';

/** The entry behind the one on screen, when it is one of ours, and the address it sits behind. */
export const stack = $state<{ behind: string | null; at: string | null }>({
	behind: null,
	at: null
});

let entries: Entries = {};
let current: number | null = null;

function readStored(): Entries {
	try {
		const stored: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? '{}');

		// oxlint-disable-next-line typescript/no-unsafe-type-assertion
		return typeof stored === 'object' && stored !== null ? (stored as Entries) : {};
	} catch {
		return {};
	}
}

function writeStored(value: Entries): void {
	try {
		sessionStorage.setItem(KEY, JSON.stringify(value));
	} catch {
		// `sessionStorage` throws in Safari private mode and on quota.
	}
}

function enterReason(): EnterReason {
	const [entry] = performance.getEntriesByType('navigation');

	return entry instanceof PerformanceNavigationTiming ? entry.type : 'navigate';
}

function indexNow(): number | null {
	const state: unknown = history.state;

	if (typeof state !== 'object' || state === null || !(HISTORY_INDEX in state)) {
		return null;
	}

	const index = state[HISTORY_INDEX];

	return typeof index === 'number' ? index : null;
}

export function recordEntry(type: string): void {
	const index = indexNow();
	const address = addressOf(location);

	stack.at = address;

	if (index === null) {
		stack.behind = null;
		return;
	}

	const before = type === 'enter' ? readStored() : entries;
	const step = stepOf(type, enterReason(), current, index);

	entries = entriesAfter(before, index, address, step);
	current = index;

	writeStored(entries);

	stack.behind = behindOf(entries, index);
}

/** Re-reads the entry on screen after a shallow `replaceState` rewrote its address. */
export function restamp(): void {
	recordEntry('replace');
}
