<script lang="ts">
	import { hintLabel, progressOf } from '$lib/domain/workout';
	import type { Exercise, History, SetCursor } from '$lib/domain/workout';
	import SetRow from '$lib/ui/SetRow.svelte';
	import type { SetStatus } from '$lib/ui/SetMark.svelte';
	import ActiveSet from '$lib/workout/ActiveSet.svelte';

	/**
	 * One exercise and its sets. The unit both containers are built from: the
	 * focused mode renders exactly one of these, the list mode renders all of
	 * them stacked, and nothing inside differs between the two.
	 */
	type Props = {
		meta: Exercise;
		cursors: SetCursor[];
		history: History;
		activeSetId: string | null;
		/** Scroll the active set back into reach. List mode only — see below. */
		autoscroll?: boolean;
		oncommit: (weight: number, reps: number) => void;
		onselect: (setId: string) => void;
	};

	let {
		meta,
		cursors,
		history,
		activeSetId,
		autoscroll = false,
		oncommit,
		onselect
	}: Props = $props();

	const progress = $derived(progressOf(cursors[0].exercise));

	// A warmup stays a warmup once logged: its disc wears a W rather than a
	// check, because it was never a working set and the list should not imply it
	// counted for anything.
	function statusOf(cursor: SetCursor): SetStatus {
		if (cursor.set.type === 'warmup') {
			return 'warmup';
		}

		if (cursor.set.completed) {
			return 'done';
		}

		return 'pending';
	}

	/**
	 * A pending row shows last time; a logged row shows nothing, because the row
	 * itself is already the answer and repeating the hint beside it invites
	 * reading the wrong pair of numbers at arm's length.
	 */
	function rowHint(cursor: SetCursor): string | null {
		if (cursor.set.completed || cursor.set.type === 'warmup') {
			return null;
		}

		return hintLabel(history, cursor);
	}

	/**
	 * In list mode the active set marches down a growing page, so after a few
	 * commits it is off the bottom and the next tap is a scroll hunt. Pulling it
	 * back to centre is the same move Hevy makes for supersets, and it is the
	 * only thing the list container has to do that the focused one gets free —
	 * worth naming, because it is exactly the cost the comparison is measuring.
	 */
	let holder = $state<HTMLElement | null>(null);

	$effect(() => {
		if (!autoscroll || holder === null || activeSetId === null) {
			return;
		}

		holder.scrollIntoView({ block: 'center', behavior: 'smooth' });
	});
</script>

<section class="flex flex-col gap-2">
	<div class="flex items-baseline justify-between gap-3 px-1">
		<div class="min-w-0">
			<h2 class="truncate text-lg font-extrabold tracking-tight text-ink">{meta.name}</h2>
			<p class="truncate text-sm font-bold text-ink-faint">
				{meta.equipment}{meta.loadMode === 'per-hand' ? ' · per hand' : ''}
			</p>
		</div>
		<span class="shrink-0 text-sm font-extrabold text-ink-faint">
			{progress.done}/{progress.total}
		</span>
	</div>

	{#each cursors as cursor (cursor.set.id)}
		{#if cursor.set.id === activeSetId}
			<!-- Keyed on the set id so a commit mounts a fresh editor rather than
			     mutating the open one underneath the user's thumb. -->
			<div bind:this={holder}>
				{#key cursor.set.id}
					<ActiveSet {cursor} {history} {oncommit} />
				{/key}
			</div>
		{:else}
			<SetRow
				status={statusOf(cursor)}
				index={cursor.workingIndex + 1}
				weight={cursor.set.weight}
				reps={cursor.set.reps}
				onselect={cursor.set.type === 'warmup' ? undefined : () => onselect(cursor.set.id)}
			>
				{#snippet right()}
					{rowHint(cursor) ?? ''}
				{/snippet}
			</SetRow>
		{/if}
	{/each}
</section>
