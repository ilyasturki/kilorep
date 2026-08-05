<script lang="ts" generics="Leg extends { id: string }">
	import type { Snippet } from 'svelte';

	import Badge from '$lib/ui/Badge.svelte';
	import ArrowsDownUp from '$lib/ui/icons/ArrowsDownUp.svelte';

	type Props = {
		legs: Leg[];
		superset: boolean;
		leg: Snippet<[Leg, number]>;
		/**
		 * Trade the leg below this divider with the one above it.
		 *
		 * Optional, and the seam is the whole reason it can be one tap: a divider
		 * stands between exactly two legs, so there is no third thing it could mean
		 * and nothing to name. Which leg to act on is not a choice the caller makes
		 * — it is the one below, always — so the argument is that leg, and every
		 * call site moves it the same direction.
		 *
		 * A superset with three legs reorders by composing these, which is the same
		 * bargain a pair of up/down arrows makes and needs no drag to stay honest.
		 * The history screen leaves it off: reordering the legs of a session already
		 * lifted is a rewrite of what happened, not a plan.
		 */
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

			<!-- The hairline's dead end, which is exactly where this belongs: the
			     control that trades two legs sits on the seam between them. `-my-2`
			     claws back the height a 44px target would otherwise add to a divider
			     that is one badge tall — the target keeps its full box, the row does
			     not grow around it. -->
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
