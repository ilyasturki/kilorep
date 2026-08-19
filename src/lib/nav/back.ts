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

	const parent = parentOf(pathname);

	// The parent is read before the root check, not after: a tab root is a peer rather than a
	// step and back leaves the app there, but the live session is an address a tab owns while
	// still answering to something above it — leaving it must not mean leaving the app.
	if (parent === null && tabRoots.includes(pathname)) {
		return { kind: 'minimize' };
	}

	if (depth > 0) {
		return { kind: 'history-back' };
	}

	return parent === null ? { kind: 'minimize' } : { kind: 'goto', path: parent };
}
