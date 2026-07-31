<script lang="ts">
	import { page } from '$app/state';

	import { isActive, navTabs } from '$lib/nav/bar.svelte';
	import { activeWorkout } from '$lib/workout/active.svelte';

	import type { LayoutProps } from './$types';

	/**
	 * The tab bar, below `lg`. Above it the same tabs are in the bar across the
	 * top — the tab list itself lives in `bar.svelte.ts`.
	 *
	 * The Workout screen is in this group because it is home now — the idle
	 * posture needs the bar to reach Templates and Exercises — but the in-gym
	 * rule still owns every pixel of it while a session is live: a bar under the
	 * commit button is a mis-tap waiting for a tired thumb. So the bar stands
	 * down for exactly that state, which is a fact the holder already publishes,
	 * not a path list kept in here.
	 *
	 * Workout also keeps its own scroll pane — the rail's geometry depends on it
	 * — so it renders straight into the flex column while every other tab sits
	 * inside the scroll box this layout owns.
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

	const onWorkout = $derived(page.url.pathname === '/workout');
	const chromeless = $derived(onWorkout && activeWorkout.session !== null);
</script>

<div class="flex min-h-0 flex-1 flex-col">
	{#if onWorkout}
		{@render children()}
	{:else}
		<div class="min-h-0 flex-1 overflow-y-auto">
			{@render children()}
		</div>
	{/if}

	{#if !chromeless}
		<nav
			aria-label="Main"
			class="shrink-0 border-t border-line-soft bg-surface pb-safe-b lg:hidden"
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
	{/if}
</div>
