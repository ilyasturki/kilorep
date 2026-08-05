<script lang="ts">
	import { page } from '$app/state';

	import { appBarSlot, isActive, navTabs } from '$lib/nav/bar.svelte';

	/**
	 * The bar on a desk, read as two parts: where you can go, then what this
	 * screen offers. Nothing else is in it.
	 *
	 * No mark. It linked to the tab beside it in an app with one user, and being
	 * there is what made the gear next to it read as brand furniture rather than
	 * as a destination — a fourth kind of thing wedged into a three-column grid.
	 * Deleting it is what let Settings become an ordinary nav member instead of
	 * a symbol hanging off the identity cluster.
	 */
	const slot = appBarSlot();
</script>

<header class="hidden shrink-0 border-b border-line-soft bg-surface pt-safe-t lg:block">
	<div class="flex items-center gap-3 px-3 py-2">
		<nav aria-label="Main" class="flex items-center gap-1">
			{#each navTabs() as tab (tab.href)}
				{@const active = isActive(page.url.pathname, tab)}
				{@const Icon = (active && tab.iconActive) || tab.icon}

				<a
					href={tab.href}
					aria-current={active ? 'page' : undefined}
					class={[
						'flex min-h-chrome items-center gap-2 rounded-xl px-3',
						'text-md font-bold focus-ring transition-colors',
						active
							? 'bg-nav-selected text-ink'
							: 'text-ink-faint pointer-fine:hover:bg-nav-hover pointer-fine:hover:text-ink-muted'
					]}
				>
					<Icon size={18} class="shrink-0" />
					{tab.label}
					{#if tab.live}
						<span class="size-1.5 rounded-full bg-accent"></span>
					{/if}
				</a>
			{/each}
		</nav>

		{#if slot.action !== null}
			<div class="ml-auto">
				{@render slot.action()}
			</div>
		{/if}
	</div>
</header>
