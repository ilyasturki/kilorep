<script lang="ts">
	import type { Entry } from '$lib/workout/groups';
	import Badge from '$lib/ui/Badge.svelte';
	import DragList from '$lib/ui/DragList.svelte';
	import { DragOrder } from '$lib/ui/dragOrder.svelte';

	type Props = {
		entries: Entry[];
		activeSetId: string | null;
		onjump: (setId: string) => void;
		onfocus: (setId: string) => void;
		oninsert: () => void;
		onreorder: (entryId: string, index: number) => void;
		ondrop?: (entryId: string) => void;
	};

	let { entries, activeSetId, onjump, onfocus, oninsert, onreorder, ondrop }: Props = $props();

	const entryIds = $derived(entries.map((entry) => entry.id));

	function target(entry: Entry, go: (setId: string) => void) {
		const cursor = entry.cursors.find((c) => !c.set.completed) ?? entry.cursors.at(-1);

		if (cursor === undefined) {
			return;
		}

		go(cursor.set.id);
	}

	const drag = new DragOrder({
		order: () => entryIds,
		move: (id, index) => {
			onreorder(id, index);

			return true;
		},
		lift: (entryId) => {
			const entry = entries.find((candidate) => candidate.id === entryId);

			if (entry !== undefined) {
				target(entry, onfocus);
			}
		},
		drop: (entryId) => ondrop?.(entryId)
	});

	function select(event: MouseEvent, entry: Entry) {
		if (drag.swallowClick(event)) {
			return;
		}

		target(entry, onjump);
	}
</script>

<DragList items={entries} {drag} addLabel="Add exercise" {oninsert} onselect={select} noDrag>
	{#snippet row(entry)}
		{@const here = entry.cursors.some((c) => c.set.id === activeSetId)}
		{@const done = entry.cursors.every((c) => c.set.completed)}

		<span class="min-w-0 flex-1">
			<span class="block truncate text-base font-extrabold tracking-tight text-ink">
				{entry.title}
			</span>
			<span class="block truncate text-sm font-bold text-ink-faint">
				{entry.superset ? 'Superset' : entry.legs[0].meta.equipment}
			</span>
		</span>

		<span class="flex shrink-0 items-center gap-2 text-md font-extrabold text-ink-muted">
			{#if here}
				<Badge tone="accent">Now</Badge>
			{:else if done}
				<Badge>Done</Badge>
			{/if}
		</span>
	{/snippet}
</DragList>
