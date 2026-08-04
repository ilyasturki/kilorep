import type { OnNavigate } from '@sveltejs/kit';
import { tick } from 'svelte';
import { prefersReducedMotion } from 'svelte/motion';
import { onNavigate } from '$app/navigation';

import { navTabs } from '$lib/nav/bar.svelte';
import { classifyMove } from '$lib/nav/move';

import type { Direction, Move } from '$lib/nav/move';

/**
 * Every route change slides, and how it slides is the meaning. Peers travel in
 * lockstep — rightward along the tab bar is `push`, leftward is `pop`, both
 * edge to edge. A screen stacked on another travels with parallax instead: the
 * one being covered gives up 30% of the distance while the one arriving crosses
 * the whole width, and a user reads that difference as one screen going behind
 * the other. No crossfade in either case; the panes are the only things that
 * move and the chrome around them holds still.
 *
 * `move.ts` decides which of those a navigation is, and this file is only the
 * edge that performs it: stamp the verdict where CSS can read it, open the
 * transition, take the stamps back off.
 *
 * The mechanics are the View Transitions API via `onNavigate`, per the
 * SvelteKit FAQ: the browser snapshots the old page, we resolve to let the
 * navigation land, and the CSS in `app.css` animates old and new side by side.
 * The element that slides is whichever wears `vt-page`, which is the `(app)`
 * layout's content box and only ever that one — a name owned by the shell
 * rather than by each screen is what guarantees both halves of every
 * navigation are the same rectangle, and a group whose geometry does not
 * change cannot morph mid-slide. A browser without `startViewTransition`
 * navigates instantly, which is the fallback and the whole fallback.
 *
 * The three stamps are separate attributes rather than one compound value
 * because CSS reads them separately: the incoming pane's animation depends on
 * direction and axis together, the outgoing pane's on both as well, and the
 * tab bar's on `data-bar` alone.
 */

/**
 * The app routes that render no tab bar — the ones outside `(tabs)`. Settings,
 * and nothing else today. Passed to `classifyMove` rather than hard-coded in
 * it for the same reason the tab list is: that file stays testable without the
 * app's route tree in front of it.
 */
const BARLESS = ['/settings'];

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
 * Whether this move should animate at all. The `typeof` is the feature detect:
 * `lib.dom` declares `startViewTransition` as always present, so `!document.
 * startViewTransition` is a branch the type checker reads as unreachable even
 * though the browsers it exists for are real.
 */
function slidingWanted(): boolean {
	return typeof document.startViewTransition === 'function' && !prefersReducedMotion.current;
}

/**
 * The transition the stamps currently belong to. Navigating again mid-slide
 * skips the first transition, and a skipped one settles *before* the slide that
 * replaced it — so without an owner the loser takes the winner's attributes off
 * on its way out and the new slide animates with nothing to read.
 */
let stampOwner: ViewTransition | undefined;

/**
 * Take the stamps back off once the transition settles, if they are still ours.
 * `finished` rejects on two different endings — skipped by a newer navigation,
 * or the navigation itself aborting — and only the first has someone else to
 * hand the attributes to. Clearing in `finally` covers the second, and the
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

			const { dataset } = document.documentElement;

			delete dataset.nav;
			delete dataset.axis;
			delete dataset.bar;
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

/**
 * Stamp the move where the CSS can read it, then run the transition.
 *
 * Stamped *before* `startViewTransition`, which matters for more than the
 * animation names: `data-bar` decides whether the tab bar carries a
 * `view-transition-name` of its own, and that has to be true of the old
 * snapshot as well as the new one. The browser captures during the rendering
 * update that follows this call, so a `dataset` write on the line above is
 * already in the style it captures.
 */
function slide({ direction, axis, bar }: Move, update: () => Promise<void>): void {
	const { dataset } = document.documentElement;

	dataset.nav = direction;
	dataset.axis = axis;
	dataset.bar = bar;

	const transition = document.startViewTransition(update);

	stampOwner = transition;

	void absorb(transition.ready);
	void absorb(transition.updateCallbackDone);
	void unstamp(transition);
}

/**
 * How this navigation slides, or `undefined` where it should not slide at all.
 * Same pathname is a search-param change — a filter, not a journey — and
 * sliding a page over an identical page is motion with nothing to say.
 */
function navigationMove(navigation: OnNavigate): Move | undefined {
	const { from, to } = navigation;

	if (from === null || to === null) {
		return undefined;
	}

	const a = from.url.pathname;
	const b = to.url.pathname;

	if (a === b || outsideShell(a) || outsideShell(b)) {
		return undefined;
	}

	return classifyMove({
		from: a,
		to: b,
		delta: navigation.delta ?? undefined,
		tabRoots: navTabs().map((tab) => tab.href),
		barless: BARLESS
	});
}

/** Called once, by the `(app)` layout — component init, like any lifecycle hook. */
export function slideNavigation(): void {
	onNavigate(async (navigation) => {
		if (!slidingWanted()) {
			return;
		}

		const move = navigationMove(navigation);

		if (move === undefined) {
			return;
		}

		// Resolving is what lets SvelteKit swap the DOM; the browser then holds the
		// transition open until the navigation has fully landed. Awaiting the same
		// deferred here is what SvelteKit waits on in turn, per the FAQ's recipe.
		const { promise, resolve }: PromiseWithResolvers<void> = Promise.withResolvers();

		slide(move, async () => {
			resolve();
			await navigation.complete;
		});

		await promise;
	});
}

/**
 * The same slide for a screen that changes posture without changing address —
 * History's edit mode is a place the user goes *into* and backs out of, and
 * the URL never hears about it. Depth, therefore, and never lateral: there is
 * one screen here and the new posture stacks on the old one. The bar holds,
 * because the address did not move and so neither did the bar.
 *
 * `mutate` flips the state; `tick` is what makes the flip visible before the
 * new snapshot is taken. Falls back to a bare flip where transitions are
 * unsupported or unwanted.
 */
export function pageSlide(direction: Direction, mutate: () => void): void {
	if (!slidingWanted()) {
		mutate();
		return;
	}

	slide({ direction, axis: 'depth', bar: 'hold' }, async () => {
		mutate();
		await tick();
	});
}
