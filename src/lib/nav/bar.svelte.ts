import { getContext, setContext } from 'svelte';

import Barbell from '$lib/ui/icons/Barbell.svelte';
import BarbellFill from '$lib/ui/icons/BarbellFill.svelte';
import ClockCounterClockwise from '$lib/ui/icons/ClockCounterClockwise.svelte';
import Gauge from '$lib/ui/icons/Gauge.svelte';
import GaugeFill from '$lib/ui/icons/GaugeFill.svelte';
import ListBullets from '$lib/ui/icons/ListBullets.svelte';
import Stack from '$lib/ui/icons/Stack.svelte';

import { activeWorkout } from '$lib/workout/active.svelte';

import type { Component, Snippet } from 'svelte';

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
/**
 * The icon contract from `ui/icons/README.md`, named so a tab can hold a
 * component rather than a string. A dispatcher is what the README rules out;
 * this is the component itself, so Vite still tree-shakes and there is no
 * runtime branch on a name.
 */
export type NavIcon = Component<{ size?: number; class?: string }>;

export type NavTab = {
	href: string;
	label: string;
	/**
	 * Bold outline, and its fill-weight partner for the selected state — the
	 * pairing `ui/icons/README.md` calls the intended one. `iconActive` is
	 * optional because one glyph has no usable fill: see `ListBullets.svelte`.
	 * A tab without it wears the outline in both states and lets the pill do
	 * the work.
	 */
	icon: NavIcon;
	iconActive?: NavIcon;
	/** A session is live behind this tab; both bars mark it with the accent dot. */
	live?: boolean;
};

/**
 * A function rather than a list, because the first tab's dot is conditional:
 * Workout is home — the screen that starts a session when none is running and
 * logs into it when one is — so the tab itself never changes, only the fact it
 * badges. The Start tab that used to share this slot is gone with the Start
 * page; one address for the workout means there is no second page to fall out
 * of step with it.
 *
 * `live` is the one departure from ink-on-faint: an accent dot on the tab, the
 * label itself still ink. The accent means "this logs a set", and a tab leading
 * back into a live session is the single nav target that can say so — as a
 * fill, per the accent's own rule, never as text. It is the only accent in
 * either bar: the selected tab is a neutral pill, because a navigation state is
 * not the thing the lime promises. The holder it reads is refilled from the
 * snapshot at boot by the `(app)` layout, so a reload cannot hide a
 * half-logged session from the bars.
 *
 * Stack wears the bold outline in both states: like ListBullets it has no
 * usable fill partner — see `ui/icons/README.md` — so the pill does the work.
 */
export function navTabs(): NavTab[] {
	return [
		{
			href: '/workout',
			label: 'Workout',
			icon: Barbell,
			iconActive: BarbellFill,
			live: activeWorkout.session !== null
		},
		{ href: '/templates', label: 'Templates', icon: Stack },
		{ href: '/exercises', label: 'Exercises', icon: ListBullets },
		// The gauge is the closest glyph Phosphor has to a scale's dial; its
		// fill is a true solid of the same object, so the pair holds.
		{ href: '/weight', label: 'Weight', icon: Gauge, iconActive: GaugeFill },
		// Bold alone, like Exercises — see the glyph's own header for why the
		// fill is no partner. PRODUCT.md still owes the bar its final order,
		// judged on the phone; History lands last until then.
		{ href: '/history', label: 'History', icon: ClockCounterClockwise }
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
 * There was a second field here, `railed`, offsetting the bar's column past the
 * Workout rail so the wordmark stayed over the set rows. The rail no longer
 * takes width from the page — it floats in the gutter beside a column centred
 * in the window like every other screen's — so there is one box to centre
 * against again and nothing left for a page to tell the bar about its layout.
 */
export class AppBarSlot {
	public action: Snippet | null = $state(null);
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
