<script lang="ts">
	import { page } from '$app/state';

	import Segmented from '$lib/ui/Segmented.svelte';
	import Books from '$lib/ui/icons/Books.svelte';
	import Cards from '$lib/ui/icons/Cards.svelte';

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
	 * Not sticky, and neither is the search field that sits directly below it on
	 * the Exercises half. Both are read on arrival and not reached for
	 * mid-scroll, and pinning either would put a second strip of chrome under
	 * the real one — which is what `top-0` in this scroll box bought the last
	 * two times it was tried. See the note on the field itself.
	 *
	 * The bar above says "Plan" on both halves; this segment is what says which
	 * half. That division is the whole reason the tab reads as one destination:
	 * neither half renames the top of the app on the way in.
	 */
	let { children }: LayoutProps = $props();

	/**
	 * `value` is the address, so the route is what lights a half and there is no
	 * second copy of "which one is open" to fall out of step with it.
	 *
	 * The glyphs name what each half *is*, and they have to differ in silhouette
	 * before they differ in detail — at 18px a reader gets the outline and
	 * nothing else. A deck of cards for the plans you keep; a shelf of books for
	 * the movements you look one up in. This pair replaced `Stack` and
	 * `ListBullets`, which said "list" twice: `Stack.svelte` is redrawn here as
	 * three bars rather than Phosphor's layered plates, so beside a bulleted list
	 * it was the same mark at a glance.
	 *
	 * `Barbell` is the mark that carries "exercise" best and is deliberately not
	 * here. It is Train's, and on a desk the Train tab sits in the bar directly
	 * above this segment — unlit, so the *same* outline barbell would stand twice
	 * on one screen for two different things.
	 */
	const halves = [
		{ value: '/templates', href: '/templates', label: 'Templates', icon: Cards },
		{ value: '/exercises', href: '/exercises', label: 'Exercises', icon: Books }
	];
</script>

{#if halves.some((half) => half.href === page.url.pathname)}
	<div class="column-content flex flex-col px-3 pt-3">
		<Segmented items={halves} value={page.url.pathname} label="Plan" />
	</div>
{/if}

{@render children()}
