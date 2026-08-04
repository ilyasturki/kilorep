import type { OnNavigate } from '@sveltejs/kit';
import { tick } from 'svelte';
import { prefersReducedMotion } from 'svelte/motion';
import { onNavigate } from '$app/navigation';

import { isActive, navTabs } from '$lib/nav/bar.svelte';

/**
 * Every route change slides, and the direction is the meaning: `push` brings
 * the new screen in from the right — deeper, or rightward along the tab bar —
 * and `pop` sends it back out the way it came. No crossfade in either: the
 * pane is the one element that moves, the chrome around it holds still, and
 * two screens travelling in lockstep read as one gesture where a fade reads
 * as a scene change.
 *
 * The mechanics are the View Transitions API via `onNavigate`, per the
 * SvelteKit FAQ: the browser snapshots the old page, we resolve to let the
 * navigation land, and the CSS in `app.css` animates old and new side by
 * side. The element that slides is whichever wears `vt-page` — the tab
 * layout's content box, Settings' column — and everything else is the frozen
 * `root` snapshot. A browser without `startViewTransition` navigates
 * instantly, which is the fallback and the whole fallback.
 */

type Direction = 'push' | 'pop';

/** The bar the two bars share, as an ordering: which tab claims this path. */
function tabIndex(pathname: string): number {
	return navTabs().findIndex((tab) => isActive(pathname, tab.href));
}

/**
 * Outside the app shell there is nothing to slide against: the marketing page
 * and the login screen carry no `vt-page`, and `/dev` is a gallery. A
 * navigation touching any of them lands instantly instead of animating one
 * half of a pair.
 */
function outsideShell(pathname: string): boolean {
	return pathname === '/' || pathname === '/login' || pathname.startsWith('/dev');
}

/**
 * Two rules, tried in order. Tab to tab follows the bar: rightward along it
 * is `push`, leftward is `pop` — the carousel the bar's order implies. Within
 * a tab, or off the bar entirely (Settings, Weight), the move is
 * hierarchical: a history traversal backwards is `pop`, climbing to a path
 * prefix (`/history/abc` → `/history`) is `pop`, and everything else is
 * going deeper.
 */
function direction(from: string, to: string, delta: number | undefined): Direction {
	const a = tabIndex(from);
	const b = tabIndex(to);

	if (a !== -1 && b !== -1 && a !== b) {
		return b > a ? 'push' : 'pop';
	}

	if (delta !== undefined && delta < 0) {
		return 'pop';
	}

	return from.startsWith(`${to}/`) ? 'pop' : 'push';
}

/**
 * Whether this move should animate at all. The `typeof` is the feature detect:
 * `lib.dom` declares `startViewTransition` as always present, so `!document.
 * startViewTransition` is a branch the type checker reads as unreachable even
 * though the browsers it exists for are real.
 */
function slidingWanted(): boolean {
	return typeof document.startViewTransition === 'function' && !prefersReducedMotion.current;
}

/**
 * The transition the stamp currently belongs to. Navigating again mid-slide
 * skips the first transition, and a skipped one settles *before* the slide that
 * replaced it — so without an owner the loser takes the winner's attribute off
 * on its way out and the new slide animates with no direction to read.
 */
let stampOwner: ViewTransition | undefined;

/**
 * Take the stamp back off once the transition settles, if it is still ours.
 * `finished` rejects on two different endings — skipped by a newer navigation,
 * or the navigation itself aborting — and only the first has someone else to
 * hand the attribute to. Clearing in `finally` covers the second, and the
 * ownership check is what keeps it from stealing from the first.
 */
async function unstamp(transition: ViewTransition): Promise<void> {
	try {
		await transition.finished;
	} catch {
		// Skipped or aborted. Both are endings; neither is a failure to report.
	} finally {
		if (stampOwner === transition) {
			stampOwner = undefined;
			delete document.documentElement.dataset.nav;
		}
	}
}

/**
 * Await a transition promise nobody reads, purely so its rejection is not left
 * on the floor. A ViewTransition exposes three of them and every ending that is
 * not a clean finish rejects all three: skipping the transition, and the update
 * callback throwing — which for us is `navigation.complete` on a navigation the
 * user replaced mid-flight. `unstamp` is the only one of the three we act on;
 * unread, the other two surface as `unhandledrejection` and read like a crash.
 */
async function absorb(settling: Promise<void>): Promise<void> {
	try {
		await settling;
	} catch {
		// An ending, not a failure. Nothing here is ours to report.
	}
}

/** Stamp the direction where the CSS can read it, then run the transition. */
function slide(dir: Direction, update: () => Promise<void>): void {
	document.documentElement.dataset.nav = dir;

	const transition = document.startViewTransition(update);

	stampOwner = transition;

	void absorb(transition.ready);
	void absorb(transition.updateCallbackDone);
	void unstamp(transition);
}

/**
 * The direction this navigation slides, or `undefined` where it should not
 * slide at all. Same pathname is a search-param change — a filter, not a
 * journey — and sliding a page over an identical page is motion with nothing
 * to say.
 */
function navigationDirection(navigation: OnNavigate): Direction | undefined {
	const { from, to } = navigation;

	if (from === null || to === null) {
		return undefined;
	}

	const a = from.url.pathname;
	const b = to.url.pathname;

	if (a === b || outsideShell(a) || outsideShell(b)) {
		return undefined;
	}

	return direction(a, b, navigation.delta);
}

/** Called once, by the `(app)` layout — component init, like any lifecycle hook. */
export function slideNavigation(): void {
	onNavigate(async (navigation) => {
		if (!slidingWanted()) {
			return;
		}

		const dir = navigationDirection(navigation);

		if (dir === undefined) {
			return;
		}

		// Resolving is what lets SvelteKit swap the DOM; the browser then holds the
		// transition open until the navigation has fully landed. Awaiting the same
		// deferred here is what SvelteKit waits on in turn, per the FAQ's recipe.
		const { promise, resolve }: PromiseWithResolvers<void> = Promise.withResolvers();

		slide(dir, async () => {
			resolve();
			await navigation.complete;
		});

		await promise;
	});
}

/**
 * The same slide for a screen that changes posture without changing address —
 * History's edit mode is a place the user goes *into* and backs out of, and
 * the URL never hears about it. `mutate` flips the state; `tick` is what
 * makes the flip visible before the new snapshot is taken. Falls back to a
 * bare flip where transitions are unsupported or unwanted.
 */
export function pageSlide(dir: Direction, mutate: () => void): void {
	if (!slidingWanted()) {
		mutate();
		return;
	}

	slide(dir, async () => {
		mutate();
		await tick();
	});
}
