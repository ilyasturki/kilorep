export type Direction = 'push' | 'pop';

export type Bar = 'hold' | 'travel';

export type Move = { direction: Direction; bar: Bar };

export type MoveContext = {
	from: string;
	to: string;
	delta?: number;
	tabRoots: readonly string[];
	barless: readonly string[];
};

function covers(pathname: string, root: string): boolean {
	return pathname === root || pathname.startsWith(`${root}/`);
}

function hasBar(pathname: string, barless: readonly string[]): boolean {
	return !barless.some((root) => covers(pathname, root));
}

/**
 * How a navigation travels, or `undefined` where it should not travel at all.
 *
 * Every move that animates is the same one: a screen going behind another, or
 * coming back out from behind it. Peers do not animate. Two tab roots are the
 * only peers this app has — nothing is *behind* anything else between them,
 * and a slide there was motion that said nothing.
 *
 * Peer means both ends are tab roots exactly, not merely under one. A tab's
 * detail screen is deeper than every root including its own, so `/dashboard` →
 * `/exercises/{id}` is a push the same as `/history` → `/history/{id}` is: the
 * bar the user came from does not change what arriving at a detail screen
 * means.
 */
export function classifyMove({
	from,
	to,
	delta,
	tabRoots,
	barless
}: MoveContext): Move | undefined {
	if (tabRoots.includes(from) && tabRoots.includes(to)) {
		return undefined;
	}

	const bar = hasBar(from, barless) === hasBar(to, barless) ? 'hold' : 'travel';

	if (delta !== undefined && delta < 0) {
		return { direction: 'pop', bar };
	}

	return { direction: from.startsWith(`${to}/`) ? 'pop' : 'push', bar };
}
