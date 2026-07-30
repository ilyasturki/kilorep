<script lang="ts">
	import { page } from '$app/state';

	import type { LayoutProps } from './$types';

	/**
	 * The tab bar. Two slots — Start and Exercises — growing as screens land:
	 * PRODUCT.md left the final allocation to be settled on the phone, and a
	 * bar that gains a tab when a screen earns one settles it incrementally
	 * instead of at a desk, with no dead placeholders in the meantime.
	 *
	 * The workout screen gets no bar at all, which is why it lives outside this
	 * `(tabs)` group, directly under `(app)`: it is a mode, not a place — Start
	 * already reroutes into it while one is active — and the in-gym rule owns
	 * every pixel of that surface; a bar under the commit button is a mis-tap
	 * waiting for a tired thumb. Chrome-less is a property of where a route
	 * sits in the tree, not of a path list kept in here.
	 *
	 * Text tabs, no icons: two words are legible at arm's length and the icon
	 * set has nothing that says "exercise" without inventing decoration. The
	 * active tab is ink against faint, never the accent — the accent means
	 * "this logs a set" and a navigation state is not that.
	 */
	let { children }: LayoutProps = $props();

	const tabs = [
		{ href: '/start', label: 'Start' },
		{ href: '/exercises', label: 'Exercises' }
	];

	function activeOf(href: string): boolean {
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}
</script>

<div class="flex h-dvh flex-col bg-canvas text-ink">
	<div class="min-h-0 flex-1 overflow-y-auto">
		{@render children()}
	</div>

	<nav aria-label="Main" class="shrink-0 border-t border-line-soft bg-surface pb-safe-b">
		<div class="mx-auto flex max-w-sm">
			{#each tabs as tab (tab.href)}
				{@const active = activeOf(tab.href)}

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
