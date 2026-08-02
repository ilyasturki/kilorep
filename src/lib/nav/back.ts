/**
 * What a back press does, decided in one pure function.
 *
 * The policy is Android's, with the tabs as peers: leave the innermost thing
 * first. An open overlay closes. A tab root minimizes the app directly, with
 * no detour through the home tab, because a bottom bar the user tapped
 * deliberately is not a stack they descended. Everything else — a workout in
 * history, a template being edited, Settings — walks real history, which is
 * the only thing that can answer "the last page" when the last page was
 * another tab's. The fixed parent survives as the fallback for the case
 * history cannot answer: a deep link, a cold boot, a notification tap.
 *
 * The detail screens used to pop to their tab root unconditionally, on the
 * argument that back never replays what the bars piled up. That held while the
 * only way into a detail screen was its own list. It stopped holding when the
 * exercise screen grew a link into a workout: pressing back there landed on
 * the History list, a place the user had not been, while the exercise they came
 * from sat one real history entry away. Tab roots keep the old rule, so the
 * peers model is intact and a press at `/workout` still never replays five tab
 * taps — the change is only that a screen *inside* a tab now prefers the truth
 * over the guess.
 *
 * `depth` is how many of the app's own pages are stacked behind this one; see
 * `depth.ts`, which is the impure half that counts them. Passing it in rather
 * than reading `history.length` is what makes "is there anywhere of ours to go
 * back to" answerable — `history.length` counts pages from other sites and
 * never comes down.
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
