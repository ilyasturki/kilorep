<script lang="ts">
	import { page } from '$app/state';

	import Segmented from '$lib/ui/Segmented.svelte';
	import ListBullets from '$lib/ui/icons/ListBullets.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';

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

	/**
	 * `value` is the address, so the route is what lights a half and there is no
	 * second copy of "which one is open" to fall out of step with it.
	 *
	 * `Stack` is the Plan tab's own glyph, standing here for the half the tab
	 * opens on. Exercises takes `ListBullets` and not `Barbell`, which is the one
	 * that would read as the lift: `Barbell` is Train's, and a segment wearing
	 * another tab's mark points at the wrong place from across the room.
	 */
	const halves = [
		{ value: '/templates', href: '/templates', label: 'Templates', icon: Stack },
		{ value: '/exercises', href: '/exercises', label: 'Exercises', icon: ListBullets }
	];
</script>

{#if halves.some((half) => half.href === page.url.pathname)}
	<div class="column-content flex flex-col px-3 pt-3">
		<Segmented items={halves} value={page.url.pathname} label="Plan" />
	</div>
{/if}

{@render children()}
