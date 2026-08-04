export type Direction = 'push' | 'pop';

export type Axis = 'lateral' | 'depth';

export type Bar = 'hold' | 'travel';

export type Move = { direction: Direction; axis: Axis; bar: Bar };

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

function tabIndex(pathname: string, tabRoots: readonly string[]): number {
	return tabRoots.findIndex((root) => covers(pathname, root));
}

function hasBar(pathname: string, barless: readonly string[]): boolean {
	return !barless.some((root) => covers(pathname, root));
}

export function classifyMove({ from, to, delta, tabRoots, barless }: MoveContext): Move {
	const bar = hasBar(from, barless) === hasBar(to, barless) ? 'hold' : 'travel';

	const a = tabIndex(from, tabRoots);
	const b = tabIndex(to, tabRoots);

	if (a !== -1 && b !== -1 && a !== b) {
		return { direction: b > a ? 'push' : 'pop', axis: 'lateral', bar };
	}

	if (delta !== undefined && delta < 0) {
		return { direction: 'pop', axis: 'depth', bar };
	}

	return { direction: from.startsWith(`${to}/`) ? 'pop' : 'push', axis: 'depth', bar };
}
