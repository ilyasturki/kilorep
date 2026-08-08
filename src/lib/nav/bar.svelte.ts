import { getContext, setContext } from 'svelte';

import Barbell from '$lib/ui/icons/Barbell.svelte';
import BarbellFill from '$lib/ui/icons/BarbellFill.svelte';
import ChartBar from '$lib/ui/icons/ChartBar.svelte';
import ChartBarFill from '$lib/ui/icons/ChartBarFill.svelte';
import Gear from '$lib/ui/icons/Gear.svelte';
import Stack from '$lib/ui/icons/Stack.svelte';

import { activeWorkout } from '$lib/workout/active.svelte';

import type { Component, Snippet } from 'svelte';

export type NavIcon = Component<{ size?: number; class?: string }>;

export type NavTab = {
	href: string;
	label: string;
	icon: NavIcon;
	iconActive?: NavIcon;
	live?: boolean;
	/**
	 * Addresses this tab owns besides its `href` — the ones that are a second
	 * face of the tab rather than a screen inside it, and so have nothing above
	 * them. Plan is one destination with two halves and its segment swaps
	 * between them without leaving the tab; Train is the idle screen and the
	 * loop, and each route's load redirects to the other the moment the holder
	 * disagrees with the address.
	 *
	 * Both have to count as roots. `back.ts` minimizes from a root, and a half
	 * that was not one would answer the same press by quitting the app — and
	 * `parentOf` draws no way up from one, which for `/workout/live` is the
	 * difference between no back link and a back link that redirects to the
	 * screen it was pressed on.
	 */
	owns?: readonly string[];
};

/**
 * The bar, read left to right as the tense of the thing each tab holds: what you
 * are doing now, what you are arranging for later, what you already did.
 *
 * Train leads, and that is not only an order — `routes/+page.ts` and
 * `AFTER_LOGIN` open the app on whichever tab does. Settings is a plain member
 * with no separator: it is reached from the bar like everywhere else, which is
 * what lets it keep the bar once you are on it.
 */
export function navTabs(): NavTab[] {
	return [
		{
			href: '/workout',
			label: 'Train',
			icon: Barbell,
			iconActive: BarbellFill,
			live: activeWorkout.session !== null,
			owns: ['/workout/live']
		},
		{ href: '/templates', label: 'Plan', icon: Stack, owns: ['/exercises'] },
		{ href: '/progress', label: 'Progress', icon: ChartBar, iconActive: ChartBarFill },
		{ href: '/settings', label: 'Settings', icon: Gear }
	];
}

export function covers(pathname: string, root: string): boolean {
	return pathname === root || pathname.startsWith(`${root}/`);
}

function rootsOf(tab: NavTab): string[] {
	return [tab.href, ...(tab.owns ?? [])];
}

export function isActive(pathname: string, tab: NavTab): boolean {
	return rootsOf(tab).some((root) => covers(pathname, root));
}

/**
 * Every address the nav treats as a root rather than as a screen inside one.
 * Not the same list as the bar's hrefs, because Plan shows one and owns two.
 */
export function tabRoots(): string[] {
	return navTabs().flatMap((tab) => rootsOf(tab));
}

/**
 * Where a screen that is not a tab root goes when back walks off the end of
 * history. Path prefix answers most of them — `/exercises/{id}` sits under
 * `/exercises` — and this covers the two it cannot: History and Weight are
 * Progress' children by the nav's design, not by their addresses, which stayed
 * flat so nothing had to be renamed.
 */
const PARENTS: Record<string, string> = {
	'/history': '/progress',
	'/weight': '/progress'
};

/**
 * The keys join the roots in the prefix search, because a named parent is a
 * parent to its own children too: `/history/{id}` walks up to the list, and the
 * list walks up to Progress. They stopped being tab roots when History left the
 * bar, and a screen no address claims is one the bar draws no back button on
 * and the hardware button answers by quitting the app.
 */
export function parentOf(pathname: string): string | null {
	const roots = tabRoots();

	// A root first, before any prefix is tried. `/workout/live` sits under
	// `/workout` by address and is a face of the same tab by design, so the
	// prefix search would hand it a parent whose load redirects straight back to
	// it — a way up that arrives where it was pressed.
	if (roots.includes(pathname)) {
		return null;
	}

	const above = [...roots, ...Object.keys(PARENTS)];

	return PARENTS[pathname] ?? above.find((root) => pathname.startsWith(`${root}/`)) ?? null;
}

/**
 * What a screen hands the bar above it — two members, and deliberately not
 * three.
 *
 * The bar is an identity strip with a fixed anatomy: **up, name, and at most
 * one act that must not sit under the thumb.** The left is the bar's own and no
 * screen may fill it, because a row whose left is sometimes the way up and
 * sometimes a control is a row you have to read before you can use. The name is
 * always drawn. Acts you want to be easy live at the foot of the screen, where
 * Templates' New template, the editor's Start and History's Repeat already are.
 *
 * `title` is the bar's middle; unset, the bar falls back to the lit tab's own
 * label, which is right for every root and wrong for nothing else, because a
 * screen deeper than a root always has a name of its own to give. At a root the
 * fallback is the *only* correct answer: a tab that named itself twice in two
 * words — Train lit below, "Workout" written above — was the one place this
 * chrome contradicted itself.
 *
 * `action` is the right-hand slot, at most one thing wide. Two screens spend
 * it: the loop, on FINISH, which rule 7 wants reachable without a scroll and
 * far from the thumb that is logging sets; and the template editor, on a desk
 * cluster its own markup withholds from a phone.
 *
 * There used to be a `leading` for the loop's overview button and a `wideAction`
 * that gave Exercises' search field the whole row and took the title off
 * screen. Both were a screen redefining the row, and between them the Plan tab
 * had two different chromes for its two halves. The overview moved beside
 * FINISH; the search moved under the segment it shares the screen with.
 */
export class AppBarSlot {
	public title: string | null = $state(null);
	public action: Snippet | null = $state(null);
}

const key = Symbol('app-bar');

export function createAppBarSlot(): AppBarSlot {
	const slot = new AppBarSlot();
	setContext(key, slot);

	return slot;
}

export function appBarSlot(): AppBarSlot {
	return getContext<AppBarSlot>(key);
}

const EMPTY = { title: null, action: null };

/**
 * Hand the bar what this screen carries, and take all of it back on the way out
 * — a title or an action left behind would be drawn over the next screen.
 *
 * `carried` is read inside the effect, so a name that is typed or a snippet that
 * swaps with a posture follows without the screen arranging for it.
 */
export function fillAppBar(carried: () => Partial<AppBarSlot>): void {
	const slot = appBarSlot();

	$effect(() => {
		Object.assign(slot, EMPTY, carried());

		return () => {
			Object.assign(slot, EMPTY);
		};
	});
}
