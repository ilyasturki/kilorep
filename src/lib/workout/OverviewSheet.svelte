<script lang="ts">
	import { progressOf } from '$lib/domain/workout';
	import type { Group } from '$lib/workout/groups';
	import Badge from '$lib/ui/Badge.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';

	/**
	 * The session overview: what is in this workout, how far through each
	 * exercise is, and a tap to go there.
	 *
	 * Jump only. Reorder and mid-workout insert belong here too and are
	 * deliberately absent — insert needs the exercise catalog, which does not
	 * exist yet.
	 *
	 * It is in this build at all because leaving it out would not cut both
	 * containers equally. The list mode barely needs it; the focused mode has no
	 * other way to move around a session, so an overview-less comparison would
	 * decide against focused for a reason that has nothing to do with focused.
	 */
	type Props = {
		open?: boolean;
		groups: Group[];
		activeSetId: string | null;
		onjump: (setId: string) => void;
	};

	let { open = $bindable(false), groups, activeSetId, onjump }: Props = $props();

	// Where a tap lands: the next set still owed, or the last one if the exercise
	// is finished — jumping to a done exercise should show it, not refuse.
	function jump(group: Group) {
		const target = group.cursors.find((c) => !c.set.completed) ?? group.cursors.at(-1);

		if (target === undefined) {
			return;
		}

		onjump(target.set.id);
		open = false;
	}
</script>

<Sheet bind:open title="Session">
	<div class="flex flex-col gap-1">
		{#each groups as group (group.meta.id)}
			{@const progress = progressOf(group.cursors[0].exercise)}
			{@const here = group.cursors.some((c) => c.set.id === activeSetId)}

			<ListRow
				title={group.meta.name}
				meta="{progress.done}/{progress.total} sets · {group.meta.equipment}"
				chevron={false}
				onclick={() => jump(group)}
			>
				{#snippet trailing()}
					{#if here}
						<Badge tone="accent">Now</Badge>
					{:else if progress.done === progress.total}
						<Badge>Done</Badge>
					{/if}
				{/snippet}
			</ListRow>
		{/each}
	</div>
</Sheet>
