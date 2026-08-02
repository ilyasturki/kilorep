/**
 * How many of the app's own pages are stacked behind the one on screen.
 *
 * Back needs one fact the browser refuses to give: whether the entry behind
 * this one belongs to kilorep. `history.length` cannot answer it — it counts
 * every page the tab has ever shown, this app's and everyone else's, and it
 * never comes down. So the app counts its own, and `back.ts` and the ‹ button
 * both read the count to decide between walking real history and falling back
 * to a fixed parent.
 *
 * The arithmetic is exported on its own and tested that way; the rest of the
 * file is the edge that reads the world — `sessionStorage`, `history.length`,
 * the navigation timing entry. No framework: the layout that mounts first
 * hands `afterNavigate`'s payload to `recordNavigation`, and this file never
 * learns what SvelteKit is. Same split as `back.ts` and `hardware-back.ts`.
 *
 * Two things it is honestly approximate about, both harmless:
 *
 * - A `goto` with `replaceState` does not push an entry, and `afterNavigate`
 *   does not say which kind it was, so the count runs one high after one. The
 *   clamp in `backDepth` catches the case that matters — signing in, where the
 *   replaced entry is the tab's first and there is genuinely nothing behind.
 * - Leaving the app for another site and coming back by link lands on a fresh
 *   document with `navigate` timing, which resets the count to zero. Coming
 *   back by *back* keeps it, which is right: the entries really are still
 *   there.
 */

/** `PerformanceNavigationTiming['type']`, named so the pure half can take it. */
export type EnterReason = 'navigate' | 'reload' | 'back_forward' | 'prerender';

/**
 * The shape of `afterNavigate`'s payload, narrowed to the two fields that
 * change the count. Structural on purpose — taking SvelteKit's `AfterNavigate`
 * would drag the framework into a file that has no other use for it.
 */
export type NavStep = { type: string; delta?: number | null };

const KEY = 'kilorep:back-depth';

/**
 * A reload keeps the stack behind it, and so does arriving by back or forward.
 * Only a fresh navigation into the app starts over — that is the deep link,
 * the typed address and the link from another site, all three of which have
 * nothing of ours behind them.
 */
export function depthOnEnter(stored: number, reason: EnterReason): number {
	return reason === 'navigate' ? 0 : Math.max(0, stored);
}

/**
 * `delta` is signed and already says how far a popstate moved, so forward
 * counts back up without a second branch. `leave` and `enter` are not steps
 * within the app and change nothing.
 */
export function depthAfter(depth: number, step: NavStep): number {
	if (step.type === 'popstate') {
		return Math.max(0, depth + (step.delta ?? 0));
	}

	if (step.type === 'link' || step.type === 'goto' || step.type === 'form') {
		return depth + 1;
	}

	return depth;
}

let counted = 0;

/**
 * Swallows every way storage can fail to matter — Safari's private mode, a
 * quota, a disabled setting. Same argument as `buzz` in `ui/haptics.ts`: none
 * of them changes what the screen does next, and a back button that falls back
 * to its parent is the behaviour the app shipped with anyway.
 */
function readStored(): number {
	try {
		return Number(sessionStorage.getItem(KEY)) || 0;
	} catch {
		return 0;
	}
}

function writeStored(value: number): void {
	try {
		sessionStorage.setItem(KEY, String(value));
	} catch {
		// Deliberately silent — see above.
	}
}

/**
 * Called once, in the browser, by the root layout — before any navigation is
 * recorded. The caller owns the browser check, because the root layout is the
 * one layout that also renders on a server: it carries the marketing page.
 *
 * `sessionStorage` and not a module variable because the count has to survive
 * a reload: pressing refresh three screens deep leaves those three entries in
 * the browser's stack, and a counter that reset would send the ‹ button to a
 * parent the user can see is not where they came from.
 *
 * `instanceof` rather than a cast: `getEntriesByType` is typed as the base
 * entry, and `PerformanceNavigationTiming['type']` is exactly `EnterReason`,
 * so narrowing gives the union for free where an assertion would only have
 * claimed it.
 */
export function startDepthTracking(): void {
	const [entry] = performance.getEntriesByType('navigation');
	const reason: EnterReason =
		entry instanceof PerformanceNavigationTiming ? entry.type : 'navigate';

	counted = depthOnEnter(readStored(), reason);
	writeStored(counted);
}

/** Called by the root layout for every navigation SvelteKit completes. */
export function recordNavigation(step: NavStep): void {
	counted = depthAfter(counted, step);
	writeStored(counted);
}

/**
 * The count, clamped to what the tab could possibly hold.
 *
 * `history.length` is a poor floor and an honest ceiling: it over-reports by
 * counting other sites, but it cannot under-report, so a count above it is
 * certainly wrong. This is what turns the `replaceState` over-count into a
 * zero on the one path where being wrong would walk the user out of the app —
 * the sign-in redirect, whose replaced entry is the tab's only one.
 */
export function backDepth(): number {
	return Math.min(counted, Math.max(0, history.length - 1));
}
