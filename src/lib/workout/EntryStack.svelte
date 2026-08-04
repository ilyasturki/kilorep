<script lang="ts" generics="Leg extends { id: string }">
	import type { Snippet } from 'svelte';

	import Badge from '$lib/ui/Badge.svelte';

	type Props = {
		legs: Leg[];
		superset: boolean;
		leg: Snippet<[Leg, number]>;
	};

	let { legs, superset, leg }: Props = $props();
</script>

{#if superset}
	<span aria-hidden="true" class="absolute inset-y-1 -left-2 w-0.5 rounded-full bg-accent-soft"
	></span>
{/if}

{#each legs as item, at (item.id)}
	{#if at > 0}
		<div class="flex items-center gap-2 px-1">
			<Badge tone="accent">Superset</Badge>
			<span class="h-px flex-1 rounded-full bg-line-soft"></span>
		</div>
	{/if}

	{@render leg(item, at)}
{/each}
