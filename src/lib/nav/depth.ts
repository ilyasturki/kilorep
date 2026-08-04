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

export type EnterReason = 'navigate' | 'reload' | 'back_forward' | 'prerender';

export type NavStep = { type: string; delta?: number | null };

const KEY = 'kilorep:back-depth';

export function depthOnEnter(stored: number, reason: EnterReason): number {
	return reason === 'navigate' ? 0 : Math.max(0, stored);
}

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
		// `sessionStorage` throws in Safari private mode and on quota.
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

export function recordNavigation(step: NavStep): void {
	counted = depthAfter(counted, step);
	writeStored(counted);
}

export function backDepth(): number {
	return Math.min(counted, Math.max(0, history.length - 1));
}
