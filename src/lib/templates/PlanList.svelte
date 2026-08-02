<script lang="ts">
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';

	import type { Planned } from '$lib/templates/plan';
	import { planSummary } from '$lib/templates/plan';
	import AddRow from '$lib/ui/AddRow.svelte';
	import { DragOrder, SETTLE } from '$lib/ui/dragOrder.svelte';
	import DotsSixVertical from '$lib/ui/icons/DotsSixVertical.svelte';

	/**
	 * What is in this plan, what each exercise asks for, a tap to go there, a
	 * drag to reorder it, and the way in for another exercise.
	 *
	 * `SessionList`'s counterpart on the planning side, and deliberately not
	 * `SessionList` itself: that component is welded to `SetCursor` — the next
	 * set still owed, the Now badge, the Done badge, the rule that a tap on a
	 * finished exercise shows it rather than refusing. A template has no cursor,
	 * nothing is completed, and generalising over the two would mean a component
	 * whose every row asked which tree it was standing in. What they share is the
	 * shell, and that is a shape, not a component.
	 *
	 * A card in the gutter from `lg` and nowhere else. Below that the plan itself
	 * is already one card per exercise on a screen with nothing beside it, so a
	 * sheet holding a second copy of the same list would be a drawer over the
	 * thing it lists. The cards keep their own grips at every width, which is
	 * what makes reordering on a phone possible without one.
	 */
	type Props = {
		groups: Planned[];
		/** A tap: show me this one. The screen scrolls its pane to the card. */
		onjump: (entryId: string) => void;
		oninsert: () => void;
		/** Put the entry at `index`. The screen hands this straight to the domain. */
		onreorder: (entryId: string, index: number) => void;
	};

	let { groups, onjump, oninsert, onreorder }: Props = $props();

	// Deduplicated for the superset reason `SessionList` gives: one entry can
	// render as several rows, and the two halves must not be offered as two slots
	// that cannot be separated.
	const entryIds = $derived([...new Set(groups.map((group) => group.entryId))]);

	const drag = new DragOrder({
		order: () => entryIds,
		move: (id, index) => {
			onreorder(id, index);

			return true;
		}
	});

	// A long-press that lifted a row still ends in a click, and the row under it
	// would scroll the pane somewhere. Same swallow `SessionList` makes.
	function select(event: MouseEvent, group: Planned) {
		if (drag.swallowClick(event)) {
			return;
		}

		onjump(group.entryId);
	}

	// Direct manipulation is not animation: the lifted row keeps following the
	// finger. What reduced motion switches off is everything it displaces.
	const slide = $derived(prefersReducedMotion.current ? 0 : 200);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && drag.cancel()} />

<div bind:this={drag.root} class="flex flex-col gap-1">
	{#each groups as group (group.id)}
		{@const lifted = drag.isLifted(group.entryId)}
		{@const settling = drag.settlingId === group.entryId}

		<!-- Outer element for flip and slot measurement, inner for the finger — the
		     same split `SessionList` makes, for the reason recorded there. -->
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
						<!-- The shape rather than the equipment: on a planning surface what
						     the row is being asked to say is how much work it is. -->
						<span class="block truncate text-sm font-bold tracking-numeral text-ink-faint">
							{planSummary(group.exercise)}
						</span>
					</span>
				</button>

				<!-- Not focusable and not announced: reorder is a pointer gesture with no
				     keyboard path, and a control Tab lands on that then ignores every key
				     is worse than one Tab skips. -->
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

	<!-- Dashed, unlike the raised row at the foot of the pane: this one stands
	     inside a `surface` card, where a surface fill has nothing to be seen
	     against. See `Button`'s `raised`. -->
	<AddRow label="Add exercise" onclick={oninsert} />
</div>
