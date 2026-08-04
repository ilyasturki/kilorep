<script lang="ts">
	import type { PlannedEntry } from '$lib/templates/plan';
	import { entrySummary } from '$lib/templates/plan';
	import DragList from '$lib/ui/DragList.svelte';
	import { DragOrder } from '$lib/ui/dragOrder.svelte';

	type Props = {
		entries: PlannedEntry[];
		onjump: (entryId: string) => void;
		oninsert: () => void;
		onreorder: (entryId: string, index: number) => void;
	};

	let { entries, onjump, oninsert, onreorder }: Props = $props();

	const entryIds = $derived(entries.map((entry) => entry.id));

	const drag = new DragOrder({
		order: () => entryIds,
		move: (id, index) => {
			onreorder(id, index);

			return true;
		}
	});

	function select(event: MouseEvent, entry: PlannedEntry) {
		if (drag.swallowClick(event)) {
			return;
		}

		onjump(entry.id);
	}
</script>

<DragList items={entries} {drag} addLabel="Add exercise" {oninsert} onselect={select}>
	{#snippet row(entry)}
		<span class="min-w-0 flex-1">
			<span class="block truncate text-base font-extrabold tracking-tight text-ink">
				{entry.title}
			</span>
			<span class="block truncate text-sm font-bold tracking-numeral text-ink-faint">
				{entrySummary(entry.legs.map((leg) => leg.exercise))}
			</span>
		</span>
	{/snippet}
</DragList>
