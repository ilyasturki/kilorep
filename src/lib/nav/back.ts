export type BackDecision =
	| { kind: 'close-overlay' }
	| { kind: 'goto'; path: string }
	| { kind: 'history-back' }
	| { kind: 'minimize' };

export type BackContext = {
	pathname: string;
	overlayOpen: boolean;
	tabRoots: readonly string[];
	depth: number;
};

export function decideBack({ pathname, overlayOpen, tabRoots, depth }: BackContext): BackDecision {
	if (overlayOpen) {
		return { kind: 'close-overlay' };
	}

	if (tabRoots.includes(pathname)) {
		return { kind: 'minimize' };
	}

	if (depth > 0) {
		return { kind: 'history-back' };
	}

	const root = tabRoots.find((tabRoot) => pathname.startsWith(`${tabRoot}/`));
	if (root !== undefined) {
		return { kind: 'goto', path: root };
	}

	return { kind: 'minimize' };
}
