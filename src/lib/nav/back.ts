export type BackDecision =
	| { kind: 'close-overlay' }
	| { kind: 'goto'; path: string }
	| { kind: 'history-back' }
	| { kind: 'minimize' };

export type BackContext = {
	pathname: string;
	overlayOpen: boolean;
	/** The addresses back answers by leaving the app rather than by going up. */
	tabRoots: readonly string[];
	/** Where this screen goes when there is no history to walk. `bar.svelte`
	 *  owns the answer, because it is the same one the bar's back link uses. */
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
