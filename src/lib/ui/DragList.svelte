<script lang="ts" generics="T extends { id: string }">
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';
	import type { Snippet } from 'svelte';

	import AddRow from '$lib/ui/AddRow.svelte';
	import { DragOrder, SETTLE } from '$lib/ui/dragOrder.svelte';
	import DotsSixVertical from '$lib/ui/icons/DotsSixVertical.svelte';

	type Props = {
		items: T[];
		drag: DragOrder;
		addLabel: string;
		oninsert: () => void;
		onselect: (event: MouseEvent, item: T) => void;
		/**
		 * Set inside a vaul drawer. Vaul latches its drag-to-dismiss claim on the
		 * first pixel of travel, long before a 500 ms hold has lifted anything, so
		 * without this the sheet follows the finger down instead of the row. Inert
		 * where there is no drawer to refuse.
		 */
		noDrag?: boolean;
		row: Snippet<[T]>;
	};

	let { items, drag, addLabel, oninsert, onselect, noDrag = false, row }: Props = $props();

	const slide = $derived(prefersReducedMotion.current ? 0 : 200);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && drag.cancel()} />

<div bind:this={drag.root} data-vaul-no-drag={noDrag ? '' : undefined} class="flex flex-col gap-1">
	{#each items as item (item.id)}
		{@const lifted = drag.isLifted(item.id)}
		{@const settling = drag.settlingId === item.id}

		<div
			data-drag-id={item.id}
			animate:flip={{ duration: slide }}
			class={lifted ? 'relative z-10 rounded-xl bg-sunken' : ''}
		>
			<div
				style:transform={lifted ? `translateY(${drag.offset}px) scale(1.02)` : null}
				style:transition={settling && !prefersReducedMotion.current ? SETTLE : null}
				class={[
					'flex min-h-row items-center gap-1 rounded-xl pr-1 pl-3',
					'pointer-fine:transition-[background-color] pointer-fine:duration-100',
					// Opaque and airborne. Tooltip is the only other thing in the app with
					// a shadow, and it is the only other thing that leaves the layout — so
					// the rule stays "a shadow means it is off the page".
					lifted ? 'bg-surface shadow-lg' : 'hover:bg-hover active:bg-surface-2'
				]}
			>
				<button
					type="button"
					onclick={(event) => onselect(event, item)}
					onpointerdown={(event) => drag.rowDown(event, item.id)}
					onpointermove={(event) => drag.move(event)}
					onpointerup={(event) => drag.up(event)}
					onpointercancel={(event) => drag.up(event)}
					class="flex min-w-0 flex-1 items-center gap-3 py-2 text-left focus-ring-inset"
				>
					{@render row(item)}
				</button>

				<span
					role="presentation"
					aria-hidden="true"
					onpointerdown={(event) => drag.handleDown(event, item.id)}
					onpointermove={(event) => drag.move(event)}
					onpointerup={(event) => drag.up(event)}
					onpointercancel={(event) => drag.up(event)}
					class="grid size-11 shrink-0 cursor-grab touch-none place-items-center
						text-ink-faint select-none"
				>
					<DotsSixVertical size={18} />
				</span>
			</div>
		</div>
	{/each}

	<AddRow label={addLabel} onclick={oninsert} />
</div>
