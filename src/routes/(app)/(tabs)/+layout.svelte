<script lang="ts">
	import { page } from '$app/state';

	import { isActive, navTabs } from '$lib/nav/bar.svelte';

	import type { LayoutProps } from './$types';

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
	 * box this layout owns.
	 *
	 * Glyph over label, and the bar is ~59px rather than the 40 a row of words
	 * needed. Two words were legible at arm's length, which is why this was text
	 * for a while, but legible is not the same as *found*: a glyph is what the
	 * eye lands on before it reads anything, and at arm's length between sets
	 * that is the whole job. The label stays under it — Start and Workout are
	 * the same slot in two states, and the word is what tells them apart.
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

	// `/templates/` and not `/templates`: the tab's own list is an ordinary
	// scrolling page, and only the editor under it owns a pane.
	const ownsPane = $derived(
		page.url.pathname === '/workout' || page.url.pathname.startsWith('/templates/')
	);
</script>

<div class="flex min-h-0 flex-1 flex-col">
	{#if ownsPane}
		{@render children()}
	{:else}
		<div class="min-h-0 flex-1 overflow-y-auto">
			{@render children()}
		</div>
	{/if}

	<nav aria-label="Main" class="shrink-0 border-t border-line-soft bg-surface pb-safe-b lg:hidden">
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
				>
					<span
						class={[
							'flex h-8 w-16 items-center justify-center rounded-full transition-colors',
							active ? 'bg-nav-selected' : 'pointer-fine:group-hover:bg-nav-hover'
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
