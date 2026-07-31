<script lang="ts">
	import { page } from '$app/state';

	import { isActive, navTabs } from '$lib/nav/bar.svelte';

	import type { LayoutProps } from './$types';

	/**
	 * The tab bar, below `lg`. Above it the same tabs are in the bar across the
	 * top — the swap, and the tab list itself, live in `bar.svelte.ts`.
	 *
	 * The workout screen gets neither bar on a phone, which is why it lives
	 * outside this group, directly under `(app)`: it is a mode, not a place —
	 * Start already reroutes into it while one is active — and the in-gym rule
	 * owns every pixel of that surface; a bar under the commit button is a
	 * mis-tap waiting for a tired thumb. Chrome-less is a property of where a
	 * route sits in the tree, not of a path list kept in here.
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
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<div class="min-h-0 flex-1 overflow-y-auto">
		{@render children()}
	</div>

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
