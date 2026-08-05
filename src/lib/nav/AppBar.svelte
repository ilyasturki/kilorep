<script lang="ts">
	import { page } from '$app/state';

	import BackLink from '$lib/nav/BackLink.svelte';
	import { appBarSlot, isActive, navTabs, parentOf } from '$lib/nav/bar.svelte';

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
	 *
	 * Back stands in the first gutter at every width. It used to be the phone's
	 * alone, which left a desk with no way out of a screen the tabs cannot name:
	 * an exercise reached from a running workout, a session opened from the
	 * History list. Both are one level under a tab, both lit that tab and drew
	 * nothing else, and the only way up was to re-enter through the tab itself —
	 * losing where you were. The gutter it now fills was empty space, so the tabs
	 * do not move to make room for it.
	 */
	const slot = appBarSlot();

	const pathname = $derived(page.url.pathname);
	const current = $derived(navTabs().find((tab) => isActive(pathname, tab)));

	const title = $derived(slot.title ?? current?.label ?? '');

	const parent = $derived(parentOf(pathname));
</script>

<header class="shrink-0 border-b border-line-soft bg-surface pt-safe-t">
	<div
		class="flex min-h-chrome items-center gap-2 px-3 py-2 lg:grid
			lg:grid-cols-[1fr_auto_1fr] lg:gap-3"
	>
		<!-- A screen carrying its own leading gives up the back link, at both
		     widths now rather than only on a phone. Workout is the one that does,
		     and it is a tab root with nowhere above it to go. -->
		{#if slot.leading !== null}
			<div class="lg:hidden">{@render slot.leading()}</div>
		{:else if parent !== null}
			<BackLink href={parent} label="Back" class="lg:col-start-1 lg:justify-self-start" />
		{/if}

		<!-- `sr-only` and not gone: an absolute 1px box takes no room from the
		     field beside it, and the screen keeps the heading it is owed. -->
		<h1
			class={[
				'min-w-0 truncate text-lg font-extrabold tracking-tight lg:hidden',
				slot.wideAction ? 'sr-only' : 'flex-1'
			]}
		>
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

		<!-- Wide, the action takes the row a title is no longer standing in; at
		     `lg` it is a grid item in the last track either way, where `flex-1`
		     means nothing and the width is the screen's own to set. -->
		{#if slot.action !== null}
			<div
				class={[
					'lg:col-start-3 lg:ml-0 lg:justify-self-end',
					slot.wideAction ? 'min-w-0 flex-1' : 'ml-auto shrink-0'
				]}
			>
				{@render slot.action()}
			</div>
		{/if}
	</div>
</header>
