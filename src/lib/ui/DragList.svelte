<script lang="ts" generics="T extends { id: string }">
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';
	import type { Snippet } from 'svelte';

	import AddRow from '$lib/ui/AddRow.svelte';
	import { DragOrder, SETTLE } from '$lib/ui/dragOrder.svelte';
	import DotsSixVertical from '$lib/ui/icons/DotsSixVertical.svelte';
	import { press } from '$lib/ui/press';

	type Props = {
		items: T[];
		drag: DragOrder;
		addLabel: string;
		oninsert: () => void;
		onselect: (event: MouseEvent, item: T) => void;
		// Set inside a vaul drawer, where the body belongs to drag-to-dismiss. The two gestures
		// cannot share a row: vaul latches on the first pixel of travel, long before a 500ms hold
		// has lifted anything, so hold-anywhere would drag the drawer instead. The grip keeps
		// reordering and is fenced off from vaul; every other pixel of the row closes the drawer.
		gripOnly?: boolean;
		row: Snippet<[T]>;
	};

	let { items, drag, addLabel, oninsert, onselect, gripOnly = false, row }: Props = $props();

	function rowDown(event: PointerEvent, id: string) {
		if (gripOnly) {
			return;
		}

		drag.rowDown(event, id);
	}

	const slide = $derived(prefersReducedMotion.current ? 0 : 200);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && drag.cancel()} />

<div bind:this={drag.root} class="flex flex-col gap-1">
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
					lifted ? 'bg-surface shadow-lg' : 'hover:bg-hover press:bg-surface-2'
				]}
				{@attach press()}
			>
				<button
					type="button"
					onclick={(event) => onselect(event, item)}
					onpointerdown={(event) => rowDown(event, item.id)}
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
					data-vaul-no-drag={gripOnly ? '' : undefined}
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
