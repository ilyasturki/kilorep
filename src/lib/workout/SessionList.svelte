<script lang="ts">
	import type { Group } from '$lib/workout/groups';
	import Badge from '$lib/ui/Badge.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';

	/**
	 * What is in this session, how far it has got, and a tap to go there.
	 *
	 * One component, two homes: a sheet on a phone, where the screen has no room
	 * to spare, and a permanent rail on a desktop, where it does. Written twice
	 * it would drift, and the jump rule below is exactly the kind of thing that
	 * drifts silently — it is the reason a tap on a finished exercise shows it
	 * rather than refusing.
	 *
	 * Jump only. Reorder and mid-workout insert belong here too and are
	 * deliberately absent — insert needs the exercise catalog, which does not
	 * exist yet.
	 */
	type Props = {
		groups: Group[];
		activeSetId: string | null;
		onjump: (setId: string) => void;
	};

	let { groups, activeSetId, onjump }: Props = $props();

	// Where a tap lands: the next set still owed, or the last one if the exercise
	// is finished — jumping to a done exercise should show it, not refuse.
	function jump(group: Group) {
		const target = group.cursors.find((c) => !c.set.completed) ?? group.cursors.at(-1);

		if (target === undefined) {
			return;
		}

		onjump(target.set.id);
	}
</script>

<div class="flex flex-col gap-1">
	{#each groups as group (group.meta.id)}
		{@const here = group.cursors.some((c) => c.set.id === activeSetId)}
		<!-- A predicate, not a count. Done/total came out of the app for restating
		     what the rows already show, and "finished" is the one part of it this
		     list cannot show for itself. -->
		{@const done = group.cursors.every((c) => c.set.completed)}

		<ListRow
			title={group.meta.name}
			meta={group.meta.equipment}
			chevron={false}
			onclick={() => jump(group)}
		>
			{#snippet trailing()}
				{#if here}
					<Badge tone="accent">Now</Badge>
				{:else if done}
					<Badge>Done</Badge>
				{/if}
			{/snippet}
		</ListRow>
	{/each}
</div>
