<script lang="ts">
	import { prefersReducedMotion } from 'svelte/motion';
	import { slide } from 'svelte/transition';

	import { hintLabel } from '$lib/domain/workout';
	import { weightStep } from '$lib/domain/exercise';
	import type { Exercise } from '$lib/domain/exercise';
	import type { History, SetCursor } from '$lib/domain/workout';
	import AddRow from '$lib/ui/AddRow.svelte';
	import { revealNearest } from '$lib/ui/scroll';
	import SetRow from '$lib/ui/SetRow.svelte';
	import type { SetStatus } from '$lib/ui/SetMark.svelte';
	import More from '$lib/ui/icons/More.svelte';
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
		/**
		 * The way in for an exercise the plan did not hold, on the add-set row.
		 * What arrives lands directly under this block — the tap said where.
		 */
		oninsert?: () => void;
		/** Handed the element that asked as well, so the desktop menu can hang from it. */
		onoptions: (setId: string, anchor: HTMLElement) => void;
		/**
		 * The ⋯ beside the name: swap the exercise, or take it out of the session.
		 * Handed its own element for the same reason, and the name hands its own
		 * when the menu is reached by right-click instead.
		 */
		onexercise: (anchor: HTMLElement) => void;
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
		oninsert,
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
	 * off the bottom and the next tap is a scroll hunt. Pulling it back into
	 * view is the price the stacked session pays for showing everything at once.
	 *
	 * Only when it actually left, and only by the shortfall — `revealNearest`
	 * holds still for a set already fully on screen, so tapping a visible row
	 * does not slide the page underneath the thumb that just landed on it, and
	 * a set that has half left the bottom rises half a card rather than
	 * travelling to the middle of the pane. The effect runs after the editor has
	 * expanded, which is the size the visibility test has to be made at: a row
	 * that fit may not fit as an editor.
	 */
	let holder = $state<HTMLElement | null>(null);

	$effect(() => {
		if (holder === null || activeSetId === null) {
			return;
		}

		revealNearest(holder);
	});

	/**
	 * The row-to-editor swap grows instead of snapping: `slide` animates the
	 * height and only the height — no fade, per the design's rule that a panel
	 * travels rather than dissolves. The rail's 200ms again, same argument as
	 * the pane's flip: one gesture, one speed. Zero under reduced motion, the
	 * app's standing idiom.
	 *
	 * The reveal effect above measures at intro start, when the editor is still
	 * a sliver — `onintroend` below re-checks at full height. `revealNearest`
	 * holds still for a set already on screen, so the second pass costs nothing
	 * when the first was enough.
	 */
	const grow = $derived(prefersReducedMotion.current ? 0 : 200);
</script>

<section class="flex flex-col gap-2">
	<!-- No done/total figure here: the rows below are the answer, one disc each,
	     and a fraction beside the name only restates them in a form that has to
	     be read rather than seen.

	     Two targets, the shape `SetRow` already has one level down: the name is a
	     link to the exercise, and the ⋯ beside it is what can be done to the
	     exercise in this session. Siblings and not nested because they have to be
	     — a button inside an anchor is invalid — and the split is the honest one
	     anyway. The header used to be a single button opening the menu, which
	     put the one question the name itself raises mid-set (which grip, what did
	     this lift last month) two taps away behind it.

	     A real `<a>` rather than a button running `goto`: a desk can middle-click
	     it and the phone's own long-press-to-share works on it. Leaving the live
	     screen is safe and always was — the holder outlives the page, and the
	     menu's own View walked out this same door.

	     Left-aligned like the heading it still is; a centred label here would be
	     a control impersonating a title bar. -->
	<div class="flex items-center gap-1">
		<a
			href="/exercises/{meta.id}"
			oncontextmenu={(e) => {
				e.preventDefault();
				onexercise(e.currentTarget);
			}}
			class="min-w-0 flex-1 rounded-xl px-1 py-1 text-left focus-ring hover:bg-hover
				active:bg-surface-2"
		>
			<h2 class="truncate text-lg font-extrabold tracking-tight text-ink">{meta.name}</h2>
			<p class="truncate text-sm font-bold text-ink-faint">
				{meta.equipment}{meta.loadMode === 'per-hand' ? ' · per hand' : ''}
			</p>
		</a>

		<!-- Always drawn, where the set row's ⋯ appears only under a mouse. What
		     differs is the neighbour it would hide behind: a tap on a set row
		     selects it and costs nothing, so a long-press there is a bonus — a tap
		     here leaves the screen, and Swap and Remove reachable by long-press
		     alone would be unreachable in practice on the device this app is for.

		     `sunken` on hover, the set row's own argument: the surface beside it
		     already lights `hover`, so a button hovering that same swatch never
		     changes colour at all. -->
		<button
			type="button"
			aria-label="Exercise options"
			onclick={(e) => onexercise(e.currentTarget)}
			class="grid size-9 shrink-0 place-items-center rounded-lg text-ink-faint focus-ring
				hover:bg-sunken hover:text-ink-muted pointer-fine:transition-[background-color,color]
				pointer-fine:duration-100"
		>
			<More size={20} />
		</button>
	</div>

	{#each cursors as cursor (cursor.set.id)}
		{#if cursor.set.id === activeSetId}
			<!-- Keyed on the set id so a commit mounts a fresh editor rather than
			     mutating the open one underneath the user's thumb.
			     `data-active-set` marks the one live editor for the screen's own
			     reveals — a jump to the already-active set changes no state, so
			     the effect above cannot be the one to answer it. -->
			<div
				bind:this={holder}
				data-active-set
				transition:slide={{ duration: grow }}
				onintroend={() => holder !== null && revealNearest(holder)}
			>
				{#key cursor.set.id}
					<ActiveSet
						{cursor}
						{history}
						step={weightStep(meta.equipment)}
						{oncommit}
						ondraft={(weight, reps) => ondraft(cursor.set.id, weight, reps)}
						onoptions={(anchor) => onoptions(cursor.set.id, anchor)}
					/>
				{/key}
			</div>
		{:else}
			<!-- The wrapper exists for the transition alone: `transition:` goes on
			     an element, and `SetRow` is a component. -->
			<div transition:slide={{ duration: grow }}>
				<SetRow
					status={statusOf(cursor)}
					index={cursor.workingIndex + 1}
					weight={cursor.set.weight}
					reps={cursor.set.reps}
					onselect={cursor.set.type === 'warmup' ? undefined : () => onselect(cursor.set.id)}
					onoptions={(anchor) => onoptions(cursor.set.id, anchor)}
				>
					{#snippet right()}
						{rowHint(cursor) ?? ''}
					{/snippet}
				</SetRow>
			</div>
		{/if}
	{/each}

	<AddRow
		label="Add set"
		onclick={onadd}
		secondaryLabel={oninsert === undefined ? undefined : 'Exercise'}
		onsecondary={oninsert}
	/>
</section>
