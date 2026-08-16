export type BackDecision =
	| { kind: 'close-overlay' }
	| { kind: 'goto'; path: string }
	| { kind: 'history-back' }
	| { kind: 'minimize' };

export type BackContext = {
	pathname: string;
	overlayOpen: boolean;
	tabRoots: readonly string[];
	parentOf: (pathname: string) => string | null;
	depth: number;
};

export function decideBack({
	pathname,
	overlayOpen,
	tabRoots,
	parentOf,
	depth
}: BackContext): BackDecision {
	if (overlayOpen) {
		return { kind: 'close-overlay' };
	}

	if (tabRoots.includes(pathname)) {
		return { kind: 'minimize' };
	}

	if (depth > 0) {
		return { kind: 'history-back' };
	}

	const parent = parentOf(pathname);

	return parent === null ? { kind: 'minimize' } : { kind: 'goto', path: parent };
}
