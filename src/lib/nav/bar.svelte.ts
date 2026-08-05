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
	 * Addresses this tab owns besides its `href`. Plan is one destination with
	 * two halves and its segment swaps between them without leaving the tab, so
	 * both have to count as roots: `back.ts` minimizes from a root, and a half
	 * that was not one would answer the same press by quitting the app.
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
			live: activeWorkout.session !== null
		},
		{ href: '/templates', label: 'Plan', icon: Stack, owns: ['/exercises'] },
		{ href: '/dashboard', label: 'Progress', icon: ChartBar, iconActive: ChartBarFill },
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
	'/history': '/dashboard',
	'/weight': '/dashboard'
};

/**
 * The keys join the roots in the prefix search, because a named parent is a
 * parent to its own children too: `/history/{id}` walks up to the list, and the
 * list walks up to Progress. They stopped being tab roots when History left the
 * bar, and a screen no address claims is one the bar draws no back button on
 * and the hardware button answers by quitting the app.
 */
export function parentOf(pathname: string): string | null {
	const above = [...tabRoots(), ...Object.keys(PARENTS)];

	return PARENTS[pathname] ?? above.find((root) => pathname.startsWith(`${root}/`)) ?? null;
}

/**
 * What a screen hands the bar above it.
 *
 * `title` is the phone bar's middle; unset, the bar falls back to the lit tab's
 * label, which is right for every tab root and wrong for nothing else, because
 * a screen deeper than a root always has a name of its own to give.
 *
 * `leading` is the phone bar's left, for the screens that want something there
 * other than the back button the bar would otherwise draw.
 */
export class AppBarSlot {
	public title: string | null = $state(null);
	public leading: Snippet | null = $state(null);
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

const EMPTY = { title: null, leading: null, action: null };

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
