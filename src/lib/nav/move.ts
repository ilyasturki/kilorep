export type Direction = 'push' | 'pop';

type MoveContext = {
	from: string;
	to: string;
	delta?: number;
	tabRoots: readonly string[];
};

export function classifyMove({ from, to, delta, tabRoots }: MoveContext): Direction | undefined {
	if (tabRoots.includes(from) && tabRoots.includes(to)) {
		return undefined;
	}

	if (delta !== undefined && delta < 0) {
		return 'pop';
	}

	return from.startsWith(`${to}/`) ? 'pop' : 'push';
}
