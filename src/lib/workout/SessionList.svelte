<script lang="ts">
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';
	import type { Group } from '$lib/workout/groups';
	import AddRow from '$lib/ui/AddRow.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { DragOrder, SETTLE } from '$lib/ui/dragOrder.svelte';
	import DotsSixVertical from '$lib/ui/icons/DotsSixVertical.svelte';

	/**
	 * What is in this session, how far it has got, a tap to go there, a drag to
	 * reorder it — which goes there too, the moment the row leaves the ground —
	 * and the way in for an exercise the plan did not hold.
	 *
	 * One component, two homes: a sheet on anything narrower than `xl`, where the
	 * screen has no room to keep it open, and a card standing in the gutter above
	 * it, where the window has room to spare beside the column. Written twice
	 * it would drift, and the jump rule below is exactly the kind of thing that
	 * drifts silently — it is the reason a tap on a finished exercise shows it
	 * rather than refusing.
	 *
	 * Not `ListRow`, which every other list in the app is built from. That
	 * component bans a control inside a clickable row — two elements competing
	 * for one tap, the same reason Switch owns its own row — and the grip is
	 * exactly such a control. So this is a shell with two buttons in it, the
	 * shape `SetRow` already has for the same reason.
	 */
	type Props = {
		groups: Group[];
		activeSetId: string | null;
		/** A tap: go to this exercise. Whatever is holding the list may leave with it. */
		onjump: (setId: string) => void;
		/**
		 * A lift: the same set becomes active, but the list stays where it is.
		 *
		 * Split from `onjump` for the overview sheet's sake, which dismisses itself
		 * on a jump — a drag that closed the sheet out from under the finger
		 * holding a row would end the gesture it just started.
		 */
		onfocus: (setId: string) => void;
		oninsert: () => void;
		/** Put the entry at `index`. The screen hands this straight to the domain. */
		onreorder: (entryId: string, index: number) => void;
		/**
		 * The drag is over and the order is final. Where the screen behind checks
		 * that the exercise it followed at the lift is still on screen — the
		 * reorder happened after that scroll, and may have carried it back off.
		 */
		ondrop?: (entryId: string) => void;
	};

	let { groups, activeSetId, onjump, onfocus, oninsert, onreorder, ondrop }: Props = $props();

	/**
	 * The draggable units are entries, not rows.
	 *
	 * A superset is one entry rendering as two rows, so the ids are deduplicated
	 * before the drag counts them — otherwise the two halves would be offered as
	 * two slots that cannot be separated.
	 */
	const entryIds = $derived([...new Set(groups.map((group) => group.entryId))]);

	// Where a gesture on a row lands: the next set still owed, or the last one if
	// the exercise is finished — going to a done exercise should show it, not
	// refuse. Which of the two callbacks receives it is the caller's business,
	// and the only difference between a tap and a lift.
	function target(group: Group, go: (setId: string) => void) {
		const cursor = group.cursors.find((c) => !c.set.completed) ?? group.cursors.at(-1);

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
		// Picking a row up is as much a statement about which exercise is being
		// talked about as tapping it, so the screen behind follows immediately —
		// otherwise a drag ends with the pane still showing whatever was there
		// before, and the user has to tap the row they just moved.
		//
		// The same target a tap picks, so a lift and a tap cannot land on different
		// sets of the same exercise — only the leaving differs, which is `onfocus`.
		// `find` and not `filter`: a superset entry renders two groups, and the
		// first of them is where its sets start.
		lift: (entryId) => {
			const group = groups.find((candidate) => candidate.entryId === entryId);

			if (group !== undefined) {
				target(group, onfocus);
			}
		},
		drop: (entryId) => ondrop?.(entryId)
	});

	// A long-press that lifted a row still ends in a click, and the row under it
	// jumps the session somewhere. Same swallow `SetRow` and `StepperField` make,
	// and it cannot reach a keyboard activation for the same reason.
	function select(event: MouseEvent, group: Group) {
		if (drag.swallowClick(event)) {
			return;
		}

		target(group, onjump);
	}

	// Direct manipulation is not animation: the lifted row has to keep following
	// the finger. What reduced motion switches off is the sliding of everything
	// it displaces, which is the part that moves without being touched.
	const slide = $derived(prefersReducedMotion.current ? 0 : 200);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && drag.cancel()} />

<div bind:this={drag.root} class="flex flex-col gap-1">
	{#each groups as group (group.id)}
		{@const here = group.cursors.some((c) => c.set.id === activeSetId)}
		<!-- A predicate, not a count. Done/total came out of the app for restating
		     what the rows already show, and "finished" is the one part of it this
		     list cannot show for itself. -->
		{@const done = group.cursors.every((c) => c.set.completed)}
		{@const lifted = drag.isLifted(group.entryId)}
		{@const settling = drag.settlingId === group.entryId}

		<!-- The outer element is what `animate:flip` moves between slots and what
		     the drag measures; the inner one is what follows the finger. They have
		     to be separate: flip snapshots the node's computed transform when it
		     starts and replays it for the whole animation, so a transform being
		     rewritten every frame would freeze the moment a neighbour was crossed.

		     While the inner is off following the finger, the outer's own box is
		     the vacated slot — so painting it sunken is the landing shown, at the
		     row's exact size, sliding with every crossing because flip moves it. -->
		<div
			data-drag-id={group.entryId}
			animate:flip={{ duration: slide }}
			class={lifted ? 'relative z-10 rounded-xl bg-sunken' : ''}
		>
			<div
				style:transform={lifted ? `translateY(${drag.offset}px) scale(1.02)` : null}
				style:transition={settling && !prefersReducedMotion.current ? SETTLE : null}
				class={[
					'flex min-h-row items-center gap-1 rounded-xl pr-1 pl-3',
					'pointer-fine:transition-[background-color] pointer-fine:duration-100',
					// Opaque and airborne. Tooltip is the only other thing in the app
					// with a shadow, and it is the only other thing that leaves the
					// layout — so the rule stays "a shadow means it is off the page".
					lifted ? 'bg-surface shadow-lg' : 'hover:bg-surface-2 active:bg-surface-2'
				]}
			>
				<button
					type="button"
					onclick={(event) => select(event, group)}
					onpointerdown={(event) => drag.rowDown(event, group.entryId)}
					onpointermove={(event) => drag.move(event)}
					onpointerup={(event) => drag.up(event)}
					onpointercancel={(event) => drag.up(event)}
					class="flex min-w-0 flex-1 items-center gap-3 py-2 text-left focus-ring-inset"
				>
					<span class="min-w-0 flex-1">
						<span class="block truncate text-base font-extrabold tracking-tight text-ink">
							{group.meta.name}
						</span>
						<span class="block truncate text-sm font-bold text-ink-faint">
							{group.meta.equipment}
						</span>
					</span>

					<span class="flex shrink-0 items-center gap-2 text-md font-extrabold text-ink-muted">
						{#if here}
							<Badge tone="accent">Now</Badge>
						{:else if done}
							<Badge>Done</Badge>
						{/if}
					</span>
				</button>

				<!-- Not focusable and not announced: reorder is a pointer gesture with
				     no keyboard path, and a control that Tab lands on and that then
				     ignores every key is worse than one Tab skips. The row's own button
				     stays the keyboard-reachable action.
				     `touch-action: none` is scoped here so the list still scrolls
				     normally everywhere else on the row. -->
				<span
					role="presentation"
					aria-hidden="true"
					onpointerdown={(event) => drag.handleDown(event, group.entryId)}
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

	<AddRow label="Add exercise" onclick={oninsert} />
</div>
