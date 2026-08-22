<script lang="ts">
	import { tick } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';

	import { covers, isActive, navTabs } from '$lib/nav/bar.svelte';
	import { press } from '$lib/ui/press';
	import { activeWorkout } from '$lib/workout/active.svelte';
	import RestBar from '$lib/workout/RestBar.svelte';

	import type { LayoutProps, Snapshot } from './$types';

	let { children }: LayoutProps = $props();

	// The plan editor scrolls a pane of its own — its sidebar and start bar dock to it — but the
	// pages under it, a plan's history among them, are ordinary scrollers: handed the pane, they
	// grow past the viewport and push the tab bar off the bottom of it.
	const ownsPane = $derived(
		covers(page.url.pathname, '/workout') || /^\/templates\/[^/]+$/u.test(page.url.pathname)
	);

	const tabs = $derived(navTabs());

	const selected = $derived(tabs.findIndex((tab) => isActive(page.url.pathname, tab)));

	let pane = $state<HTMLElement | null>(null);

	// SvelteKit's own scroll restoration reads `pageYOffset`, but the window here never
	// scrolls (this pane does) and its router forces `history.scrollRestoration = 'manual'`.
	export const snapshot: Snapshot<number> = {
		capture: () => pane?.scrollTop ?? 0,
		restore: async (top) => {
			// Restore runs while the pane still has the outgoing page's height;
			// assigning a deep offset to a short pane clamps it silently.
			await tick();

			if (pane !== null) {
				pane.scrollTop = top;
			}
		}
	};

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

	{#if activeWorkout.session !== null}
		<RestBar />
	{/if}

	<nav
		aria-label="Main"
		class="vt-tabbar shrink-0 border-t border-line-soft bg-surface px-1 pb-safe-b lg:hidden"
	>
		<div
			class="relative mx-auto flex max-w-sm"
			style="--seg-count: {tabs.length}; --seg-index: {selected}"
		>
			<!-- `aria-hidden`: `aria-current` on the link is what states the selection. Absent while
			     no tab owns the route, so it never parks under the wrong one. -->
			{#if selected >= 0}
				<span aria-hidden="true" class="tab-pill">
					<span class="h-8 w-full max-w-16 rounded-full bg-nav-selected pointer-coarse:h-9"></span>
				</span>
			{/if}

			{#each tabs as tab (tab.href)}
				{@const active = isActive(page.url.pathname, tab)}
				{@const Icon = (active && tab.iconActive) || tab.icon}

				<a
					href={tab.href}
					aria-current={active ? 'page' : undefined}
					class={[
						'group relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-1',
						'focus-ring transition-colors',
						active ? 'text-ink' : 'text-ink-faint pointer-fine:hover:text-ink-muted'
					]}
					{@attach press()}
				>
					<span
						class={[
							'flex h-8 w-full max-w-16 items-center justify-center rounded-full',
							'transition-colors pointer-coarse:h-9',
							!active && 'group-[.is-pressed]:bg-nav-hover pointer-fine:group-hover:bg-nav-hover'
						]}
					>
						<span class="relative flex">
							<Icon size={22} />
							{#if tab.live}
								<span class="absolute -top-0.5 -right-1 size-1.5 rounded-full bg-accent"></span>
							{/if}
						</span>
					</span>

					<!-- The label is the half that gives. Five tabs of `w-16` plus five words wider than
					     that is a min-content the bar cannot honour on a zoomed phone, and it used to
					     answer by scrolling sideways — a row of five that has to be scrolled to is not a
					     tab bar. The icon is the tab; the word under it truncates before the bar breaks. -->
					<span class="max-w-full truncate text-xs font-medium">{tab.label}</span>
				</a>
			{/each}
		</div>
	</nav>
</div>
