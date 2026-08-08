<script lang="ts">
	import { page } from '$app/state';

	import BackLink from '$lib/nav/BackLink.svelte';
	import { appBarSlot, isActive, navTabs, parentOf } from '$lib/nav/bar.svelte';

	/**
	 * One bar, both viewports, one row, one anatomy: **up · name · at most one
	 * act.**
	 *
	 * Fixed in that order and fixed in what may fill each part, which is the
	 * whole point of the thing. A screen hands over a name and an action and
	 * nothing else — see `AppBarSlot`. It cannot take the row, cannot take the
	 * left, and cannot put its name away. Four tab roots therefore draw the same
	 * row with one word in it, and the row stops being something you read on
	 * arrival.
	 *
	 * That word is the lit tab's, so the bar and the tabs cannot say two
	 * different things about one place. The acts a screen wants *easy* are not
	 * here: they are at the foot, under the thumb, where Templates' New
	 * template, the editor's Start and History's Repeat already sit. The
	 * right-hand slot is for the opposite — something that must be findable and
	 * must not be easy to hit, which on a phone is FINISH and nothing else.
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
		class="flex min-h-bar items-center gap-2 px-3 py-2 lg:grid
			lg:grid-cols-[1fr_auto_1fr] lg:gap-3"
	>
		<!-- The left is the way up and nothing else. No screen can fill it: the
		     loop's overview button stood here once, and a corner that is the exit
		     on five screens and a drawer on the sixth is a corner you have to
		     read before you press. Empty at a root, which every tab is — see
		     `owns` for why `/workout/live` counts as one. -->
		{#if parent !== null}
			<BackLink href={parent} label="Back" class="lg:col-start-1 lg:justify-self-start" />
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

		<!-- The end of the row on a phone, the last track at `lg`, and never wider
		     than what it holds: the title keeps the space, so a screen with a long
		     name and a screen with a short one put their action in the same place.
		     A field that wanted the whole row is what `wideAction` was for, and
		     the reason it is gone. -->
		{#if slot.action !== null}
			<div class="ml-auto shrink-0 lg:col-start-3 lg:ml-0 lg:justify-self-end">
				{@render slot.action()}
			</div>
		{/if}
	</div>
</header>
