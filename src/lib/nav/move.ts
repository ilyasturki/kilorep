export type Direction = 'push' | 'pop';

type MoveContext = {
	from: string;
	to: string;
	delta?: number;
	tabRoots: readonly string[];
};

/**
 * How a navigation travels, or `undefined` where it should not travel at all.
 *
 * Every move that animates is the same one: a screen going behind another, or
 * coming back out from behind it. Peers do not animate. Tab roots are the only
 * peers this app has — nothing is *behind* anything else between them, and a
 * slide there was motion that said nothing.
 *
 * Peer means both ends are tab roots exactly, not merely under one. A tab's
 * detail screen is deeper than every root including its own, so `/progress` →
 * `/exercises/{id}` is a push the same as `/history` → `/history/{id}` is: the
 * tab the user came from does not change what arriving at a detail screen
 * means.
 */
export function classifyMove({ from, to, delta, tabRoots }: MoveContext): Direction | undefined {
	if (tabRoots.includes(from) && tabRoots.includes(to)) {
		return undefined;
	}

	if (delta !== undefined && delta < 0) {
		return 'pop';
	}

	return from.startsWith(`${to}/`) ? 'pop' : 'push';
}
