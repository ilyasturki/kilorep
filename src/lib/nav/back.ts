/**
 * What a hardware back press does, decided in one pure function.
 *
 * The policy is Android's, with the tabs as peers: leave the innermost thing
 * first. An open overlay closes. A screen inside a tab — a workout in
 * history, a template being edited — pops to its tab's root. A tab root
 * minimizes the app directly, with no detour through the home tab, because a
 * bottom bar the user tapped deliberately is not a stack they descended.
 * Anything off the tab grid — Settings, login — walks real history, and
 * minimizes only when there is none to walk.
 *
 * Deciding on the pathname rather than the history stack is what makes the
 * peers model hold without touching how the bars navigate: tab taps may pile
 * history entries, but back never replays them.
 *
 * Plain TS. The tab roots arrive as an argument precisely so this file does
 * not import the bar (Svelte, icons) and stays testable on its own; the
 * wiring in `hardware-back.ts` passes the real list.
 */

export type BackDecision =
	| { kind: 'close-overlay' }
	| { kind: 'goto'; path: string }
	| { kind: 'history-back' }
	| { kind: 'minimize' };

export type BackContext = {
	pathname: string;
	overlayOpen: boolean;
	tabRoots: readonly string[];
	historyLength: number;
};

export function decideBack({
	pathname,
	overlayOpen,
	tabRoots,
	historyLength
}: BackContext): BackDecision {
	if (overlayOpen) {
		return { kind: 'close-overlay' };
	}

	if (tabRoots.includes(pathname)) {
		return { kind: 'minimize' };
	}

	const root = tabRoots.find((tabRoot) => pathname.startsWith(`${tabRoot}/`));
	if (root !== undefined) {
		return { kind: 'goto', path: root };
	}

	if (historyLength > 1) {
		return { kind: 'history-back' };
	}

	return { kind: 'minimize' };
}
