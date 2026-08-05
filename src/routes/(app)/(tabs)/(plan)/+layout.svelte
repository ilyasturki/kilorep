<script lang="ts">
	import { page } from '$app/state';

	import type { LayoutProps } from './$types';

	/**
	 * The Plan tab's two halves. Templates and Exercises are both reference
	 * material you maintain between sessions, so they are one destination with a
	 * segment rather than two tabs — the group is what lets them share this
	 * chrome without either one moving address.
	 *
	 * Only over the two lists. A template's editor and an exercise's detail are
	 * one level down, and a segment on them would offer to swap the screen you
	 * are standing on for a sibling of its parent.
	 *
	 * Not sticky: the one screen below with a sticky element of its own —
	 * Exercises' search field, which its comment says must never be a scroll away
	 * — already owns `top-0` in this scroll box.
	 */
	let { children }: LayoutProps = $props();

	const halves = [
		{ href: '/templates', label: 'Templates' },
		{ href: '/exercises', label: 'Exercises' }
	];

	const onList = $derived(halves.some((half) => half.href === page.url.pathname));
</script>

{#if onList}
	<div class="column-content flex flex-col px-3 pt-3">
		<!-- A raised pill on a well, not the accent: `Chip` paints its selected
		     state with the accent fill, and the accent means "this logs a set".
		     `surface` over `sunken` is the depth ramp saying the same thing
		     neutrally, and it reads in both themes without a per-theme pair. -->
		<nav aria-label="Plan" class="flex max-w-sm gap-1 rounded-2xl bg-sunken p-1">
			{#each halves as half (half.href)}
				{@const active = page.url.pathname === half.href}

				<!-- `replacestate` because a half is a filter, not a place: both are
				     tab roots, and `back.ts` minimizes from a tab root, so pushing an
				     entry here would make browser back undo a segment tap on the web
				     while Android back quit the app. -->
				<a
					href={half.href}
					data-sveltekit-replacestate
					aria-current={active ? 'page' : undefined}
					class={[
						'flex min-h-chrome flex-1 items-center justify-center rounded-xl',
						'text-md font-bold focus-ring transition-colors',
						active ? 'bg-surface text-ink' : 'text-ink-faint pointer-fine:hover:text-ink-muted'
					]}
				>
					{half.label}
				</a>
			{/each}
		</nav>
	</div>
{/if}

{@render children()}
