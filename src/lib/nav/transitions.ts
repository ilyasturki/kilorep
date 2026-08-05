import type { OnNavigate } from '@sveltejs/kit';
import { tick } from 'svelte';
import { prefersReducedMotion } from 'svelte/motion';
import { onNavigate } from '$app/navigation';

import { navTabs } from '$lib/nav/bar.svelte';
import { classifyMove } from '$lib/nav/move';
import { coarsePointer } from '$lib/ui/pointer';

import type { Direction, Move } from '$lib/nav/move';

/**
 * A screen stacked on another travels with parallax: the one being covered
 * gives up 30% of the distance while the one arriving crosses the whole width,
 * and a user reads that difference as one screen going behind the other. No
 * crossfade; the panes are the only things that move and the chrome around
 * them holds still. Peers do not travel at all — `move.ts` has that rule and
 * the reasoning behind it.
 *
 * `move.ts` decides whether a navigation travels and which way, and this file
 * is only the edge that performs it: stamp the verdict where CSS can read it,
 * open the transition, take the stamps back off.
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
 * One stamp, `data-nav`, and the panes' animations are all that read it. The
 * tab bar needs none: it is on both sides of every navigation now that Settings
 * is a tab, so it never leaves with a screen.
 */

function outsideShell(pathname: string): boolean {
	return pathname === '/' || pathname === '/login' || pathname.startsWith('/dev');
}

/**
 * Whether this move should animate at all.
 *
 * `coarsePointer` is the mobile gate: this travel is the phone's idiom, where
 * a screen arriving from the edge is how the platform itself says "deeper",
 * and on a desk the same slide is a window animating for no reason. The read
 * is the app's one pointer read, module scope, so a touchscreen laptop counts
 * as a phone — the honest cost of not asking the user what they are.
 *
 * The `typeof` is the feature detect: `lib.dom` declares `startViewTransition`
 * as always present, so `!document.startViewTransition` is a branch the type
 * checker reads as unreachable even though the browsers it exists for are real.
 */
function slidingWanted(): boolean {
	return (
		coarsePointer &&
		typeof document.startViewTransition === 'function' &&
		!prefersReducedMotion.current
	);
}

let stampOwner: ViewTransition | undefined;

async function unstamp(transition: ViewTransition): Promise<void> {
	try {
		await transition.finished;
	} catch {
		// Absorbed: the stamp must come off however the transition ended.
	} finally {
		if (stampOwner === transition) {
			stampOwner = undefined;

			const { dataset } = document.documentElement;

			delete dataset.nav;
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
		// The whole point: swallow it so it is not an unhandledrejection.
	}
}

/**
 * Stamp the move where the CSS can read it, then run the transition.
 *
 * Stamped *before* `startViewTransition`: the browser captures during the
 * rendering update that follows this call, so a `dataset` write on the line
 * above is already in the style it captures.
 */
function slide({ direction }: Move, update: () => Promise<void>): void {
	const { dataset } = document.documentElement;

	dataset.nav = direction;

	const transition = document.startViewTransition(update);

	stampOwner = transition;

	void absorb(transition.ready);
	void absorb(transition.updateCallbackDone);
	void unstamp(transition);
}

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
		tabRoots: navTabs().map((tab) => tab.href)
	});
}

export function slideNavigation(): void {
	onNavigate(async (navigation) => {
		if (!slidingWanted()) {
			return;
		}

		const move = navigationMove(navigation);

		if (move === undefined) {
			return;
		}

		const { promise, resolve }: PromiseWithResolvers<void> = Promise.withResolvers();

		slide(move, async () => {
			resolve();
			await navigation.complete;
		});

		await promise;
	});
}

export function pageSlide(direction: Direction, mutate: () => void): void {
	if (!slidingWanted()) {
		mutate();
		return;
	}

	slide({ direction }, async () => {
		mutate();
		await tick();
	});
}
