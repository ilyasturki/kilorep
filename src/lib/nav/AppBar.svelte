<script lang="ts">
	import { page } from '$app/state';

	import BackLink from '$lib/nav/BackLink.svelte';
	import { appBarSlot, backTo, isActive, navTabs } from '$lib/nav/bar.svelte';

	const slot = appBarSlot();

	const pathname = $derived(page.url.pathname);
	const current = $derived(navTabs().find((tab) => isActive(pathname, tab)));

	const title = $derived(slot.title ?? current?.label ?? '');

	const parent = $derived(backTo(page.url));
</script>

<header class="shrink-0 border-b border-line-soft bg-surface pt-safe-t">
	<div
		class="flex min-h-bar items-center gap-2 px-3 py-2 lg:grid
			lg:grid-cols-[1fr_auto_1fr] lg:gap-3"
	>
		<!-- One group, not two children: on `lg` the bar is a three-column grid, and a second
		     child claiming `col-start-1` would sit on top of the first. -->
		{#if parent !== null || slot.leading !== null}
			<div class="flex shrink-0 items-center gap-1 lg:col-start-1 lg:justify-self-start">
				{#if parent !== null}
					<BackLink href={parent} label="Back" />
				{/if}

				{#if slot.leading !== null}
					{@render slot.leading()}
				{/if}
			</div>
		{/if}

		<h1 class="min-w-0 flex-1 truncate text-lg font-extrabold tracking-tight lg:hidden">
			{title}
		</h1>

		<nav aria-label="Main" class="hidden items-center gap-1 lg:col-start-2 lg:flex">
			{#each navTabs() as tab (tab.href)}
				{@const active = isActive(pathname, tab)}
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
			<div class="ml-auto shrink-0 lg:col-start-3 lg:ml-0 lg:justify-self-end">
				{@render slot.action()}
			</div>
		{/if}
	</div>
</header>
