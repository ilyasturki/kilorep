<script lang="ts">
	import { page } from '$app/state';

	import { isActive, tabs } from '$lib/nav/bar.svelte';

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
	 * Text tabs, no icons: two words are legible at arm's length and the icon
	 * set has nothing that says "exercise" without inventing decoration. The
	 * active tab is ink against faint, never the accent — the accent means
	 * "this logs a set" and a navigation state is not that.
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
			{#each tabs as tab (tab.href)}
				{@const active = isActive(page.url.pathname, tab.href)}

				<a
					href={tab.href}
					aria-current={active ? 'page' : undefined}
					class={[
						'flex min-h-chrome flex-1 items-center justify-center rounded-xl',
						'label-caps focus-ring',
						active ? 'text-ink' : 'text-ink-faint hover:text-ink-muted'
					]}
				>
					{tab.label}
				</a>
			{/each}
		</div>
	</nav>
</div>
