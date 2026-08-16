<script lang="ts">
	import { page } from '$app/state';

	import Segmented from '$lib/ui/Segmented.svelte';
	import Books from '$lib/ui/icons/Books.svelte';
	import Cards from '$lib/ui/icons/Cards.svelte';

	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

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
