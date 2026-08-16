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

	const ownsPane = $derived(
		covers(page.url.pathname, '/workout') || page.url.pathname.startsWith('/templates/')
	);

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
		class="vt-tabbar shrink-0 border-t border-line-soft bg-surface pb-safe-b lg:hidden"
	>
		<div class="mx-auto flex max-w-sm">
			{#each navTabs() as tab (tab.href)}
				{@const active = isActive(page.url.pathname, tab)}
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
