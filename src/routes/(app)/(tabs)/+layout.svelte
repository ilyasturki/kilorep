<script lang="ts">
	import { tick } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';

	import { isActive, navTabs } from '$lib/nav/bar.svelte';
	import { press } from '$lib/ui/press';

	import type { LayoutProps, Snapshot } from './$types';

	/**
	 * The tab bar, below `lg`. Above it the same tabs are in the bar across the
	 * top — the tab list itself lives in `bar.svelte.ts`.
	 *
	 * The bar stands on every tab, the Workout screen included, and it used not
	 * to: while a session was live this layout dropped it, reading rule 7 as
	 * "nothing below the commit button". That left the one screen a user spends
	 * an hour on with no way out of it — Templates, Exercises and History all
	 * unreachable until the workout was finished — which is a worse tax on the
	 * session than the mis-tap it was avoiding. The gap between the commit
	 * button and the bar is the answer to the tired thumb, not the absence of
	 * the bar. Decided on the floor; the accent dot on the Workout tab is what
	 * says the session is still there.
	 *
	 * Workout and the template editor keep their own scroll panes — the geometry
	 * of the card each floats in its left gutter depends on the pane being the
	 * full width of the window and scrolling at its edge — so those two render
	 * straight into the flex column while every other tab sits inside the scroll
	 * box this layout owns. Both of Workout's addresses do: the idle screen
	 * scrolls its own `main` too, and a tab whose two halves scrolled in
	 * different boxes would jump on the way between them.
	 *
	 * Glyph over label, and the bar is ~59px rather than the 40 a row of words
	 * needed. Two words were legible at arm's length, which is why this was text
	 * for a while, but legible is not the same as *found*: a glyph is what the
	 * eye lands on before it reads anything, and at arm's length between sets
	 * that is the whole job. The label stays under it as the word for the glyph,
	 * one word in every state — Workout is Workout whether one is running or
	 * not, and the accent dot is what says which.
	 *
	 * The selected tab is a capsule behind the glyph alone, not a pill around the
	 * whole tab: with two tabs in a 384px group a full-tab pill is a 192px slab,
	 * and the capsule stays the same 64px whether there are two tabs here or
	 * five. Hover is the same capsule one step lighter — `nav-hover` and
	 * `nav-selected` are a pair for that reason, see `app.css` — and is gated on
	 * `pointer-fine` so a thumb cannot leave one stuck on after a tap.
	 *
	 * Neutral, never the accent: the accent means "this logs a set" and a
	 * navigation state is not that. The one exception is the dot on a live
	 * Workout tab, which is — it badges the glyph's corner here and follows the
	 * label in the top bar, those being the corners each layout has. See
	 * `navTabs`.
	 *
	 * The viewport and the top bar belong to `(app)`; this is a `flex-1` box
	 * inside them.
	 */
	let { children }: LayoutProps = $props();

	// `isActive` for Workout, because the tab is two addresses now — the idle
	// screen and the loop under it — and both own a pane. `/templates/` with the
	// slash and no helper, because there the tab's own list is an ordinary
	// scrolling page and only the editor under it owns one.
	const ownsPane = $derived(
		isActive(page.url.pathname, '/workout') || page.url.pathname.startsWith('/templates/')
	);

	let pane = $state<HTMLElement | null>(null);

	/**
	 * Where each tab was scrolled to, given back on the way back.
	 *
	 * SvelteKit already restores scroll per history entry and it has never once
	 * worked here, for a reason that is this layout's doing: `scroll_state()`
	 * reads `pageYOffset`, and the window in this app does not scroll. `(app)`
	 * is `h-dvh`, the scroller is the box below, and the number the framework
	 * dutifully saves and restores is a permanent zero. Worse, its router sets
	 * `history.scrollRestoration = 'manual'` at boot, so the browser's own
	 * restoration is switched off underneath it and there is nothing to fall
	 * back on. A snapshot is the sanctioned way to say what the framework
	 * cannot see, and one on the layout covers every screen that shares this
	 * box — Dashboard, Exercises, History, Templates, and Weight, off the bar
	 * now but still a screen — because the box is one element that outlives
	 * the navigations between them.
	 *
	 * Back and forward only, which is the whole contract of a snapshot: it is
	 * keyed to the history entry being returned to. Tapping a tab is a new
	 * entry and still lands at the top, which is what a tap on a destination
	 * should do.
	 *
	 * `tick` before the write, because restore runs while the incoming page is
	 * still the outgoing one's height — assigning a deep offset to a short pane
	 * clamps it, and the clamp is silent. Waiting is also what sequences this
	 * against the page-level snapshots underneath: Exercises restores its
	 * search text in the same pass, and the offset has to be measured against
	 * the list that text produces, not the unfiltered one it replaces.
	 *
	 * Zero when the route owns its own pane and this box is not rendered, which
	 * is Workout and the template editor. Workout deliberately has no snapshot
	 * of its own: it pulls the live set into the pane as it mounts, so coming
	 * back mid-session lands on the set being logged rather than on an offset —
	 * measured on a phone, back from a tab returned the active set to the pane
	 * from a page the user had scrolled to the top. That is rule 7's answer and
	 * it beats a remembered offset, which would put a returning thumb wherever
	 * the last glance happened to leave it. The scroll it lands with is instant
	 * and not animated, so there is nothing here for a snapshot to race.
	 */
	export const snapshot: Snapshot<number> = {
		capture: () => pane?.scrollTop ?? 0,
		restore: async (top) => {
			await tick();

			if (pane !== null) {
				pane.scrollTop = top;
			}
		}
	};

	/**
	 * And the other half: a tab tapped is a tab opened at the top.
	 *
	 * The box below is one element for every tab in it, and nothing was resetting
	 * it — SvelteKit zeroes `pageYOffset`, which this app does not use. So the
	 * offset leaked across every tap and arrived clamped to whatever the next
	 * tab happened to be tall enough to hold: measured on a phone, Exercises at
	 * 1200 handed History a 747 it had never asked for, and Weight a 947. Not a
	 * restoration and not a top — a number with no meaning on either screen.
	 *
	 * Everything except a popstate, because a popstate is the snapshot's and
	 * this would undo it. `enter` writes a zero over a zero on first mount,
	 * which costs nothing and is worth the one less branch.
	 */
	afterNavigate((navigation) => {
		if (navigation.type !== 'popstate' && pane !== null) {
			pane.scrollTop = 0;
		}
	});
</script>

<div class="flex min-h-0 flex-1 flex-col">
	{#if ownsPane}
		{@render children()}
	{:else}
		<div bind:this={pane} class="min-h-0 flex-1 overflow-y-auto">
			{@render children()}
		</div>
	{/if}

	<!-- `vt-tabbar` is what keeps this bar out of the sliding pane. The box that
	     travels is `(app)`'s, and this bar is inside it — but an element with a
	     `view-transition-name` of its own is lifted out of its ancestor's
	     snapshot, so naming it here is what makes it stand still while the page
	     under it moves. That is the whole trick, and it has no exceptions: every
	     screen this layout navigates to renders the bar. See the `vt-tabbar`
	     rule in app.css. -->
	<nav
		aria-label="Main"
		class="vt-tabbar shrink-0 border-t border-line-soft bg-surface pb-safe-b lg:hidden"
	>
		<div class="mx-auto flex max-w-sm">
			{#each navTabs() as tab (tab.href)}
				{@const active = isActive(page.url.pathname, tab.href)}
				{@const Icon = (active && tab.iconActive) || tab.icon}

				<a
					href={tab.href}
					aria-current={active ? 'page' : undefined}
					class={[
						'group flex flex-1 flex-col items-center gap-1 rounded-xl py-1',
						'focus-ring transition-colors',
						active ? 'text-ink' : 'text-ink-faint pointer-fine:hover:text-ink-muted'
					]}
					{@attach press()}
				>
					<!-- `h-9` under a thumb: the glyph steps 22→28 there (see the
					     `data-glyph` table in app.css) and 28 in a 32px capsule left a
					     2px halo pretending to be a fit. The bar grows the 4px and
					     nothing else moves. -->
					<!-- The press tint goes on the capsule, not on the tab, so a thumb
					     lights the same shape the selected state uses. Written as an
					     explicit `group-[.is-pressed]` rather than the `press:` variant
					     because the class the recognizer sets lands on the anchor, and
					     the shape that has to answer for it is this child. No sink: a
					     tab that shrinks inside a fixed bar reads as a glitch, and the
					     bar already has travel of its own. -->
					<span
						class={[
							'flex h-8 w-16 items-center justify-center rounded-full transition-colors',
							'pointer-coarse:h-9',
							active
								? 'bg-nav-selected'
								: 'group-[.is-pressed]:bg-nav-hover pointer-fine:group-hover:bg-nav-hover'
						]}
					>
						<span class="relative flex">
							<Icon size={22} />
							{#if tab.live}
								<span class="absolute -top-0.5 -right-1 size-1.5 rounded-full bg-accent"></span>
							{/if}
						</span>
					</span>

					<span class="text-xs font-bold">{tab.label}</span>
				</a>
			{/each}
		</div>
	</nav>
</div>
