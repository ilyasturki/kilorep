import { getContext, setContext } from 'svelte';

import Barbell from '$lib/ui/icons/Barbell.svelte';
import BarbellFill from '$lib/ui/icons/BarbellFill.svelte';
import ChartBar from '$lib/ui/icons/ChartBar.svelte';
import ChartBarFill from '$lib/ui/icons/ChartBarFill.svelte';
import ClockCounterClockwise from '$lib/ui/icons/ClockCounterClockwise.svelte';
import ListBullets from '$lib/ui/icons/ListBullets.svelte';
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
};

export function navTabs(): NavTab[] {
	return [
		{ href: '/dashboard', label: 'Dashboard', icon: ChartBar, iconActive: ChartBarFill },
		{
			href: '/workout',
			label: 'Workout',
			icon: Barbell,
			iconActive: BarbellFill,
			live: activeWorkout.session !== null
		},
		{ href: '/history', label: 'History', icon: ClockCounterClockwise },
		{ href: '/templates', label: 'Templates', icon: Stack },
		{ href: '/exercises', label: 'Exercises', icon: ListBullets }
	];
}

export function isActive(pathname: string, href: string): boolean {
	return pathname === href || pathname.startsWith(`${href}/`);
}

export class AppBarSlot {
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
