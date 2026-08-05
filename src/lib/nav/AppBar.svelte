<script lang="ts">
	import { page } from '$app/state';

	import { appBarSlot, isActive, navTabs, parentOf } from '$lib/nav/bar.svelte';
	import { backDepth } from '$lib/nav/depth';

	/**
	 * One bar, both viewports, one row.
	 *
	 * One row and not two blocks swapped at `lg`, because the action belongs to
	 * both and a snippet rendered in each would put two of every FINISH in the
	 * document. What changes across the breakpoint is which members are drawn,
	 * never how many times the slot is.
	 *
	 * A flex row under a thumb and a three-column grid above `lg`, where the tabs
	 * take the middle track and the action the last. Every screen in this app
	 * reads in a column centred in the window, and tabs pinned to the left edge
	 * pointed at nothing — but centring them with an auto margin would only have
	 * split the space *left over* beside the action, which is off-centre by half
	 * an action. Two `1fr` gutters put them on the window's axis whatever sits in
	 * the right one, including nothing.
	 */
	const slot = appBarSlot();

	const pathname = $derived(page.url.pathname);
	const current = $derived(navTabs().find((tab) => isActive(pathname, tab)));

	const title = $derived(slot.title ?? current?.label ?? '');

	const parent = $derived(parentOf(pathname));

	/**
	 * Back walks real history wherever there is any of this app's behind us, and
	 * falls back to the parent where there is not — a cold boot straight onto a
	 * detail screen, or a notification tap, which has nothing to walk.
	 */
	function walkBack(event: MouseEvent): void {
		const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

		if (event.button !== 0 || modified || backDepth() === 0) {
			return;
		}

		event.preventDefault();
		history.back();
	}
</script>

<header class="shrink-0 border-b border-line-soft bg-surface pt-safe-t">
	<div
		class="flex min-h-chrome items-center gap-2 px-3 py-2 lg:grid
			lg:grid-cols-[1fr_auto_1fr] lg:gap-3"
	>
		{#if slot.leading !== null}
			<div class="lg:hidden">{@render slot.leading()}</div>
		{:else if parent !== null}
			<a
				href={parent}
				aria-label="Back"
				onclick={walkBack}
				class="grid min-h-chrome w-11 shrink-0 place-items-center rounded-full border
					border-line text-xl leading-none text-ink-muted focus-ring hover:bg-hover
					active:bg-surface-2 lg:hidden"
			>
				‹
			</a>
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
