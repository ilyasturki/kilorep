<script lang="ts">
	import { hintLabel } from '$lib/domain/workout';
	import type { Exercise, History, SetCursor } from '$lib/domain/workout';
	import SetRow from '$lib/ui/SetRow.svelte';
	import type { SetStatus } from '$lib/ui/SetMark.svelte';
	import ActiveSet from '$lib/workout/ActiveSet.svelte';

	/**
	 * One exercise and its sets. The unit the session is stacked from.
	 */
	type Props = {
		meta: Exercise;
		cursors: SetCursor[];
		history: History;
		activeSetId: string | null;
		oncommit: (weight: number, reps: number) => void;
		onselect: (setId: string) => void;
		onadd: () => void;
		onoptions: (setId: string) => void;
	};

	let { meta, cursors, history, activeSetId, oncommit, onselect, onadd, onoptions }: Props =
		$props();

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
	 * The active set marches down a growing page, so after a few commits it is
	 * off the bottom and the next tap is a scroll hunt. Pulling it back to
	 * centre is the same move Hevy makes for supersets, and it is the price the
	 * stacked session pays for showing everything at once.
	 */
	let holder = $state<HTMLElement | null>(null);

	$effect(() => {
		if (holder === null || activeSetId === null) {
			return;
		}

		holder.scrollIntoView({ block: 'center', behavior: 'smooth' });
	});
</script>

<section class="flex flex-col gap-2">
	<!-- No done/total figure here: the rows below are the answer, one disc each,
	     and a fraction beside the name only restates them in a form that has to
	     be read rather than seen. -->
	<div class="min-w-0 px-1">
		<h2 class="truncate text-lg font-extrabold tracking-tight text-ink">{meta.name}</h2>
		<p class="truncate text-sm font-bold text-ink-faint">
			{meta.equipment}{meta.loadMode === 'per-hand' ? ' · per hand' : ''}
		</p>
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
				onoptions={() => onoptions(cursor.set.id)}
			>
				{#snippet right()}
					{rowHint(cursor) ?? ''}
				{/snippet}
			</SetRow>
		{/if}
	{/each}

	<!-- A pending row's silhouette with nothing in it: the block grows by one of
	     the same shape rather than sprouting a control of a kind the list has
	     nowhere else. `+` is a character — the icons README is explicit that a
	     glyph Nunito carries never becomes an SVG. -->
	<button
		type="button"
		onclick={onadd}
		class="grid min-h-row place-items-center rounded-xl border border-dashed border-line
			text-ink-muted focus-ring hover:bg-surface-2 active:bg-surface-2"
	>
		<span class="label-caps">+ Add set</span>
	</button>
</section>
