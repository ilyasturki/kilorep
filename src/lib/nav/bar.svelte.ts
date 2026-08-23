import { getContext, setContext } from 'svelte';

import Barbell from '$lib/ui/icons/Barbell.svelte';
import BarbellFill from '$lib/ui/icons/BarbellFill.svelte';
import ChartBar from '$lib/ui/icons/ChartBar.svelte';
import ChartBarFill from '$lib/ui/icons/ChartBarFill.svelte';
import Gauge from '$lib/ui/icons/Gauge.svelte';
import GaugeFill from '$lib/ui/icons/GaugeFill.svelte';
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
	owns?: readonly string[];
};

export function navTabs(): NavTab[] {
	return [
		{
			href: '/train',
			label: 'Train',
			icon: Barbell,
			iconActive: BarbellFill,
			live: activeWorkout.session !== null,
			owns: ['/train/live']
		},
		{ href: '/plan/templates', label: 'Plan', icon: Stack, owns: ['/plan/exercises'] },
		{ href: '/progress', label: 'Progress', icon: ChartBar, iconActive: ChartBarFill },
		{ href: '/bodyweight', label: 'Weight', icon: Gauge, iconActive: GaugeFill },
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

export function tabRoots(): string[] {
	return navTabs().flatMap((tab) => rootsOf(tab));
}

// The live session names History rather than `/train`, which redirects straight back to it,
// and rather than nothing: Train owns the address, but leaving a running session is a step
// inside the app, not the end of it. The session keeps running; the tab's dot is the way in.
const PARENTS: Record<string, string> = {
	'/history': '/progress',
	'/train/live': '/history'
};

export function parentOf(pathname: string): string | null {
	const named = PARENTS[pathname];

	if (named !== undefined) {
		return named;
	}

	const roots = tabRoots();

	if (roots.includes(pathname)) {
		return null;
	}

	return (
		[...roots, ...Object.keys(PARENTS)].find((root) => pathname.startsWith(`${root}/`)) ?? null
	);
}

export class AppBarSlot {
	public title: string | null = $state(null);
	// Sits where the panel it opens comes from, beside back rather than instead of it: a live
	// session owes the lifter both the way out and the way into its own session list, and the
	// list being one tap away on a phone is the only thing standing in for the desktop rail.
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

export function fillAppBar(carried: () => Partial<AppBarSlot>): void {
	const slot = appBarSlot();

	$effect(() => {
		Object.assign(slot, EMPTY, carried());

		return () => {
			Object.assign(slot, EMPTY);
		};
	});
}
