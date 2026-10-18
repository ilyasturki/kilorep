// SvelteKit's own counter in `history.state`: a push moves it up by one, a replace leaves it.
export const HISTORY_INDEX = 'sveltekit:history';

export type EnterReason = 'navigate' | 'reload' | 'back_forward' | 'prerender';

export type Step = 'fresh' | 'push' | 'replace' | 'traverse';

/** The address each history entry of ours holds, by SvelteKit's index for it. */
export type Entries = Record<number, string>;

export function stepOf(
	type: string,
	reason: EnterReason,
	previous: number | null,
	index: number
): Step {
	if (type === 'enter') {
		return reason === 'navigate' ? 'fresh' : 'traverse';
	}

	if (type === 'popstate') {
		return 'traverse';
	}

	return previous !== null && index > previous ? 'push' : 'replace';
}

export function entriesAfter(
	entries: Entries,
	index: number,
	address: string,
	step: Step
): Entries {
	if (step === 'fresh') {
		return { [index]: address };
	}

	const kept =
		step === 'push'
			? Object.fromEntries(Object.entries(entries).filter(([at]) => Number(at) < index))
			: entries;

	return Object.fromEntries([...Object.entries(kept), [index, address]]);
}

export function behindOf(entries: Entries, index: number): string | null {
	return entries[index - 1] ?? null;
}
