import { getContext, setContext } from 'svelte';

import { activeWorkout } from '$lib/workout/session.svelte';

import type { Snippet } from 'svelte';

/**
 * The app's navigation, in one place because it is drawn twice.
 *
 * The same tabs appear at the bottom of a phone and in a bar across the top of
 * a desk. That is not two navigations: it is one, anchored where each device
 * can reach it. DESIGN.md's one-thumb rule is the whole reason a bottom bar
 * exists, and it stops applying the moment the pointer is a mouse — where a bar
 * pinned to the bottom of a 1080px window is just a strip marooned below the
 * content it belongs to.
 *
 * Both bars grow a slot as each screen lands, which is why the list lives here
 * and not inside either one of them.
 */
export interface NavTab {
	href: string;
	label: string;
	/** A session is live behind this tab; both bars mark it with the accent dot. */
	live?: boolean;
}

/**
 * A function rather than a list, because the first slot is conditional: while
 * a workout is live it reads Workout and points at it, not Start. The same
 * slot, not a third tab — Start's destination *is* the workout for as long as
 * one exists, and `/start` reroutes there to keep the claim honest.
 *
 * `live` is the one departure from ink-on-faint: an accent dot beside the
 * label, the label itself still ink. The accent means "this logs a set", and
 * a tab leading back into a live session is the single nav target that can
 * say so — as a fill, per the accent's own rule, never as text.
 */
export function navTabs(): NavTab[] {
	return [
		activeWorkout.session === null
			? { href: '/start', label: 'Start' }
			: { href: '/workout', label: 'Workout', live: true },
		{ href: '/exercises', label: 'Exercises' }
	];
}

export function isActive(pathname: string, href: string): boolean {
	return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The parts of the top bar that belong to the page under it.
 *
 * `action` is the right-hand slot. It is filled only when a screen has earned
 * it — today that is the Workout screen's FINISH and nothing else. An always-on
 * global action would have to be invented before there is one, and the tab bar
 * already established the rule: a slot appears when a screen fills it, never as
 * a placeholder waiting for one.
 *
 * `railed` says the page's content column is offset past a left rail. The bar's
 * contents sit above the page's content column rather than the window, so the
 * wordmark lines up with what is under it — and on the Workout screen what is
 * under it starts after 240px of session rail. Without this the bar's column
 * and the set rows would be centred against different boxes and miss each other
 * by about 120px on a 1440px screen, which is exactly the kind of near-miss
 * that reads as carelessness rather than as a layout.
 */
export class AppBarSlot {
	public action: Snippet | null = $state(null);
	public railed: boolean = $state(false);
}

const key = Symbol('app-bar');

/** Called once, by the `(app)` layout that owns the bar. */
export function createAppBarSlot(): AppBarSlot {
	const slot = new AppBarSlot();
	setContext(key, slot);

	return slot;
}

/** Called by a page that fills the slot, or by the bar that reads it. */
export function appBarSlot(): AppBarSlot {
	return getContext<AppBarSlot>(key);
}
