<script lang="ts">
	import { hintLabel } from '$lib/domain/workout';
	import type { Exercise } from '$lib/domain/exercise';
	import type { History, SetCursor } from '$lib/domain/workout';
	import AddRow from '$lib/ui/AddRow.svelte';
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
		ondraft: (setId: string, weight: number | null, reps: number | null) => void;
		onselect: (setId: string) => void;
		onadd: () => void;
		onoptions: (setId: string) => void;
		/** The exercise itself: swap it, or take it out of the session. */
		onexercise: () => void;
	};

	let {
		meta,
		cursors,
		history,
		activeSetId,
		oncommit,
		ondraft,
		onselect,
		onadd,
		onoptions,
		onexercise
	}: Props = $props();

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
	 * A row with nothing in it shows last time; a row carrying numbers shows
	 * nothing, because the row itself is already the answer and repeating the
	 * hint beside it invites reading the wrong pair at arm's length.
	 *
	 * The test is the values and not `completed`: a set the cursor has reached
	 * holds its prefill from that moment on, so an uncompleted row can be showing
	 * `82.5 × 7` — and `82.5 × 7` printed twice on one row, once as the set and
	 * once as the recall, is the exact confusion this rule exists to prevent.
	 */
	function rowHint(cursor: SetCursor): string | null {
		if (cursor.set.weight !== null || cursor.set.reps !== null || cursor.set.type === 'warmup') {
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
	     be read rather than seen.

	     The name is the button, and the whole header is its target: what a tap
	     is about is the exercise, and the sheet it opens is titled with the name
	     the thumb landed on. Left-aligned like the heading it still is — a
	     centred label here would be a control impersonating a title bar. -->
	<button
		type="button"
		onclick={onexercise}
		class="min-w-0 rounded-xl px-1 py-1 text-left focus-ring hover:bg-surface-2
			active:bg-surface-2"
	>
		<h2 class="truncate text-lg font-extrabold tracking-tight text-ink">{meta.name}</h2>
		<p class="truncate text-sm font-bold text-ink-faint">
			{meta.equipment}{meta.loadMode === 'per-hand' ? ' · per hand' : ''}
		</p>
	</button>

	{#each cursors as cursor (cursor.set.id)}
		{#if cursor.set.id === activeSetId}
			<!-- Keyed on the set id so a commit mounts a fresh editor rather than
			     mutating the open one underneath the user's thumb. -->
			<div bind:this={holder}>
				{#key cursor.set.id}
					<ActiveSet
						{cursor}
						{history}
						{oncommit}
						ondraft={(weight, reps) => ondraft(cursor.set.id, weight, reps)}
						onoptions={() => onoptions(cursor.set.id)}
					/>
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

	<AddRow label="Add set" onclick={onadd} />
</section>
