/**
 * What one route change *is*, decided in one pure function.
 *
 * A slide needs three answers, and only the first of them used to be asked:
 *
 * - `direction` — which way the screens travel. Rightward along the tab bar and
 *   deeper into a screen are both `push`; back out of either is `pop`.
 * - `axis` — whether the two screens are peers or stacked. Peers move in
 *   lockstep, edge to edge, because neither is behind the other. Stacked
 *   screens move at different speeds: the one being covered gives up only 30%
 *   of the distance, and that difference is the whole depth cue. Without it a
 *   push into a detail screen and a hop between two tabs are the same gesture
 *   saying two different things.
 * - `bar` — whether the phone's tab bar is the same bar on both sides of the
 *   move. It usually is, and then it must not travel: chrome that slides out
 *   and slides back in identical reads as the whole screen tearing away. The
 *   exception is Settings, which renders no bar at all, and there the bar has
 *   to leave with the screen it belongs to rather than blink out from under a
 *   page that is still moving.
 *
 * The tab list and the barless routes arrive as arguments, which is what keeps
 * this file plain TypeScript: `bar.svelte.ts` imports icons, and taking the
 * real list from it would drag Svelte into a module whose whole point is being
 * testable without it. Same split as `back.ts` against `hardware-back.ts`, and
 * `depth.ts`'s pure half against its impure one.
 */

export type Direction = 'push' | 'pop';

/** Peers side by side, or one screen stacked on another. */
export type Axis = 'lateral' | 'depth';

/** Whether the phone's tab bar stands still or travels with its screen. */
export type Bar = 'hold' | 'travel';

export type Move = { direction: Direction; axis: Axis; bar: Bar };

export type MoveContext = {
	from: string;
	to: string;
	/** `afterNavigate`'s signed history step, when the move was a traversal. */
	delta?: number;
	/** The tab roots, in bar order — the ordering `lateral` is measured against. */
	tabRoots: readonly string[];
	/** App routes that render no tab bar. `/settings`, and so far nothing else. */
	barless: readonly string[];
};

/** The same predicate `isActive` applies in the bars, spelled out to stay pure. */
function covers(pathname: string, root: string): boolean {
	return pathname === root || pathname.startsWith(`${root}/`);
}

/** Which bar position claims this path, or -1 for a screen that is on no tab. */
function tabIndex(pathname: string, tabRoots: readonly string[]): number {
	return tabRoots.findIndex((root) => covers(pathname, root));
}

/**
 * Whether a route renders the phone's tab bar, which is the same question as
 * whether it lives inside the `(tabs)` group — Weight is off the bar and still
 * inside it, so the tab list cannot answer this and the exclusions have to be
 * named. A route added outside `(tabs)` and not listed there will slide its
 * screen while leaving the bar standing under a page that is no longer there.
 */
function hasBar(pathname: string, barless: readonly string[]): boolean {
	return !barless.some((root) => covers(pathname, root));
}

/**
 * Two rules, tried in order, and the first one is the whole of `lateral`.
 *
 * If both ends sit under a tab — any screen under it, not just the tab's own
 * root — the bar's order decides, and the move is lateral. That is deliberately
 * wider than "both ends are tab roots": the exercise screen links into a
 * workout, so `/exercises/abc` → `/history/xyz` crosses the bar while both ends
 * are detail screens, and the honest reading of that jump is the same sideways
 * one the bar would have made. Depth would have to claim the user descended
 * into something, and they did not — they went sideways to a different tab that
 * happens to be deep.
 *
 * Everything else is stacked: within one tab (`/history` → `/history/abc`), or
 * off the bar entirely — Settings, and Weight, which is a screen the Dashboard
 * leads into rather than a tab. A backwards traversal is a `pop`, climbing to a
 * path prefix is a `pop`, and anything else is going deeper.
 */
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
