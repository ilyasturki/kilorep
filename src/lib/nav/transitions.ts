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
 * Stamp the direction where the CSS can read it, run the transition, and take
 * the stamp back off once it settles — `finished` also rejects when a second
 * navigation skips this one, and the attribute must not outlive either end.
 */
function slide(dir: Direction, update: () => Promise<void>): void {
	document.documentElement.dataset.nav = dir;

	const transition = document.startViewTransition(update);

	void transition.finished.finally(() => {
		delete document.documentElement.dataset.nav;
	});
}

/** Called once, by the `(app)` layout — component init, like any lifecycle hook. */
export function slideNavigation(): void {
	onNavigate((navigation) => {
		if (!document.startViewTransition || prefersReducedMotion.current) {
			return;
		}

		const from = navigation.from?.url.pathname;
		const to = navigation.to?.url.pathname;

		// Same pathname is a search-param change — a filter, not a journey — and
		// sliding a page over an identical page is motion with nothing to say.
		if (from === undefined || to === undefined || from === to) {
			return;
		}

		if (outsideShell(from) || outsideShell(to)) {
			return;
		}

		return new Promise((resolve) => {
			slide(direction(from, to, navigation.delta), async () => {
				// The resolve is what lets SvelteKit swap the DOM; the browser then
				// holds the transition open until the navigation has fully landed.
				resolve();
				await navigation.complete;
			});
		});
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
	if (!document.startViewTransition || prefersReducedMotion.current) {
		mutate();
		return;
	}

	slide(dir, async () => {
		mutate();
		await tick();
	});
}
