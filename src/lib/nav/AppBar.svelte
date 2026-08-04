<script lang="ts">
	import { page } from '$app/state';

	import favicon from '$lib/assets/favicon.svg';
	import { appBarSlot, isActive, navTabs } from '$lib/nav/bar.svelte';
	import Gear from '$lib/ui/icons/Gear.svelte';

	const slot = appBarSlot();

	const onSettings = $derived(isActive(page.url.pathname, '/settings'));
</script>

<header class="hidden shrink-0 border-b border-line-soft bg-surface pt-safe-t lg:block">
	<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-2">
		<div class="flex items-center gap-2 justify-self-start">
			<a
				href="/dashboard"
				aria-label="Kilorep — dashboard"
				class="grid place-items-center rounded-md focus-ring"
			>
				<img src={favicon} alt="" class="size-5" />
			</a>

			<a
				href="/settings"
				aria-label="Settings"
				aria-current={onSettings ? 'page' : undefined}
				class={[
					'grid min-h-chrome w-10 place-items-center rounded-xl focus-ring transition-colors',
					onSettings
						? 'bg-nav-selected text-ink'
						: 'text-ink-faint pointer-fine:hover:bg-nav-hover pointer-fine:hover:text-ink-muted'
				]}
			>
				<Gear size={18} />
			</a>
		</div>

		<nav aria-label="Main" class="flex items-center gap-1">
			{#each navTabs() as tab (tab.href)}
				{@const active = isActive(page.url.pathname, tab.href)}
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
			<div class="justify-self-end">
				{@render slot.action()}
			</div>
		{/if}
	</div>
</header>
