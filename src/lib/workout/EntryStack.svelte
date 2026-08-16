<script lang="ts" generics="Leg extends { id: string }">
	import type { Snippet } from 'svelte';

	import Badge from '$lib/ui/Badge.svelte';
	import ArrowsDownUp from '$lib/ui/icons/ArrowsDownUp.svelte';

	type Props = {
		legs: Leg[];
		superset: boolean;
		leg: Snippet<[Leg, number]>;
		onswap?: (leg: Leg) => void;
		swapLabel?: (leg: Leg) => string;
	};

	let { legs, superset, leg, onswap, swapLabel }: Props = $props();
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

			{#if onswap}
				<button
					type="button"
					aria-label={swapLabel === undefined ? 'Swap the order of these' : swapLabel(item)}
					onclick={() => onswap(item)}
					class="-my-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-faint
						focus-ring hover:bg-hover active:bg-surface-2"
				>
					<ArrowsDownUp size={16} />
				</button>
			{/if}
		</div>
	{/if}

	{@render leg(item, at)}
{/each}
