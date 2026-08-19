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
			href: '/workout',
			label: 'Train',
			icon: Barbell,
			iconActive: BarbellFill,
			live: activeWorkout.session !== null,
			owns: ['/workout/live']
		},
		{ href: '/templates', label: 'Plan', icon: Stack, owns: ['/exercises'] },
		{ href: '/progress', label: 'Progress', icon: ChartBar, iconActive: ChartBarFill },
		{ href: '/weight', label: 'Weight', icon: Gauge, iconActive: GaugeFill },
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

const PARENTS: Record<string, string> = {
	'/history': '/progress'
};

export function parentOf(pathname: string): string | null {
	const roots = tabRoots();

	if (roots.includes(pathname)) {
		return null;
	}

	const above = [...roots, ...Object.keys(PARENTS)];

	return PARENTS[pathname] ?? above.find((root) => pathname.startsWith(`${root}/`)) ?? null;
}

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

export function fillAppBar(carried: () => Partial<AppBarSlot>): void {
	const slot = appBarSlot();

	$effect(() => {
		Object.assign(slot, EMPTY, carried());

		return () => {
			Object.assign(slot, EMPTY);
		};
	});
}
