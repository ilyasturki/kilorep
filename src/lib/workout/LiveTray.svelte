<script lang="ts">
	import { weightStep } from '$lib/domain/exercise';
	import { loadUnitLabel } from '$lib/exercises/label';
	import type { Exercise } from '$lib/domain/exercise';
	import type { History, SetCursor } from '$lib/domain/workout';
	import Button from '$lib/ui/Button.svelte';
	import { mediumMs } from '$lib/ui/motion';
	import { press, SLOP } from '$lib/ui/press';
	import Check from '$lib/ui/icons/Check.svelte';
	import ActiveSet from '$lib/workout/ActiveSet.svelte';

	type Props = {
		cursor: SetCursor | null;
		meta: Exercise | undefined;
		/** Which superset leg the set belongs to; null outside one. */
		leg?: string | null;
		note: string | null;
		history: History;
		/** Sets in the whole session — what the finish panel counts. */
		total: number;
		/**
		 * Whether the tray stands over the bottom edge. Lowered by the handle, raised by the page
		 * — a set tapped in the list, a set logged, a rest run out. The page owns it because
		 * every one of those happens outside the tray.
		 */
		open?: boolean;
		/**
		 * The tray's measured height, read back by the page. It stands *over* the list rather
		 * than beside it, so the list has no way to know how much of its own floor is covered —
		 * this is the number it keeps clear under its last row.
		 */
		span?: number;
		/**
		 * How much of the tray still stands once it is lowered: the handle's strip and the
		 * home-indicator inset under it. What the page keeps clear below the list instead.
		 */
		peek?: number;
		/** Off where last time is beside the point — editing a record older than "last time". */
		hints?: boolean;
		finishLabel?: string;
		oncommit: (weight: number, reps: number) => void;
		ondraft: (weight: number | null, reps: number | null) => void;
		onrate: (rpe: number | null) => void;
		onoptions: (anchor: HTMLElement) => void;
		onfinish: () => void;
	};

	let {
		cursor,
		meta,
		leg = null,
		note,
		history,
		total,
		open = $bindable(true),
		span = $bindable(0),
		peek = $bindable(0),
		hints = true,
		finishLabel = 'FINISH',
		oncommit,
		ondraft,
		onrate,
		onoptions,
		onfinish
	}: Props = $props();

	// The drag. Only the handle strip takes it: the tray below is nothing but controls, and a
	// pull that started on a stepper would be the lifter reaching for a number, not the edge.
	// Same shape as the row swipe — a captured pointer, a threshold, and a flick that carries.

	/** px per ms of flick that settles the tray the way it was thrown, from anywhere in the pull. */
	const FLING = 0.5;

	const SETTLE_AT = 0.35;

	// Not the strip's own height: lowered, the strip is the whole of what the thumb has to find.
	const PEEK_TARGET = 44;

	let inset = $state(0);

	$effect(() => {
		peek = PEEK_TARGET + inset;
	});

	// How far the tray travels between standing and lowered.
	const travel = $derived(Math.max(0, span - peek));

	let pulled = $state(0);
	let dragging = $state(false);

	let drag: { id: number; y0: number; y: number; at: number; v: number } | null = null;
	let swallow = false;

	// How far the tray sits below its resting place: the finger's travel while a pull is in
	// hand, and once it is down, all but the peek — the handle stays where a thumb can bring
	// it back. A transform rather than a height, so what it uncovers on the way is the list
	// already standing behind it rather than a box being resized around it.
	const lowered = $derived(open ? pulled : travel + pulled);

	function dragStart(event: PointerEvent & { currentTarget: HTMLElement }) {
		// Cleared here rather than after the click: a drag that settles the tray may leave no
		// click behind, and a flag left standing would eat the next honest tap on the handle.
		swallow = false;

		if (!event.isPrimary) {
			return;
		}

		drag = { id: event.pointerId, y0: event.clientY, y: event.clientY, at: event.timeStamp, v: 0 };

		event.currentTarget.setPointerCapture(event.pointerId);
	}

	function dragMove(event: PointerEvent) {
		if (drag === null || event.pointerId !== drag.id) {
			return;
		}

		const elapsed = event.timeStamp - drag.at;

		if (elapsed > 0) {
			drag.v = (event.clientY - drag.y) / elapsed;
			drag.y = event.clientY;
			drag.at = event.timeStamp;
		}

		const dy = event.clientY - drag.y0;

		if (!dragging && Math.abs(dy) <= SLOP) {
			return;
		}

		dragging = true;

		// Each way is refused rather than rubber-banded past where the tray can go: nothing
		// stands above it open, and nothing below the peek once it is down.
		pulled = open ? Math.max(0, Math.min(dy, travel)) : Math.max(-travel, Math.min(dy, 0));
	}

	function dragEnd() {
		if (drag === null) {
			return;
		}

		const dragged = dragging;
		const moved = Math.abs(pulled);
		const thrown = open ? drag.v > FLING : drag.v < -FLING;
		const settles = dragged && (moved >= travel * SETTLE_AT || thrown);

		drag = null;
		dragging = false;
		pulled = 0;

		// The click the browser fires after a drag is not a tap: it would undo a pull that
		// came back, or raise a tray just pulled down. Only a gesture that never became a drag
		// may still be one — and `tap` reads this rather than a capture listener, which on the
		// target itself would run after the click handler, not before.
		swallow = dragged;

		if (settles) {
			open = !open;
		}
	}

	// A tap on the handle never lowers: a handle is what a thumb rests on and drags, and one
	// that dismissed on contact took the editor away from a lifter reaching for it. Lowered,
	// the tap is the one way back a thumb can find. A keyboard has no drag, so its press
	// (`detail` 0) toggles either way.
	function tap(event: MouseEvent) {
		if (swallow) {
			swallow = false;

			return;
		}

		if (!open || event.detail === 0) {
			open = !open;
		}
	}
</script>

<!-- One box, standing over the list rather than beside it. The page keeps a floor of `span`
     clear under its last row, so every pixel the tray covers has a set laid out beneath it —
     which is the whole point of a transform here: lowering the tray uncovers the rows that
     were already there, where a collapsing slot uncovered the page's own ground and let the
     list reflow into it afterwards.

     `inert` on the body rather than a `{#if}`: the tray stays mounted so the editor keeps the
     numbers it was opened on, and a lowered editor must not answer a tab key, a thumb or a
     screen reader. The handle stays live — it is the way back. -->
<div
	class={[
		'absolute inset-x-0 bottom-0 z-10 overflow-hidden rounded-t-sheet border-t border-line',
		'bg-surface',
		!dragging &&
			mediumMs() > 0 &&
			'transition-transform duration-(--dur-medium) ease-(--ease-medium)'
	]}
	style:transform={lowered === 0 ? undefined : `translateY(${lowered}px)`}
	bind:offsetHeight={span}
>
	<span aria-hidden="true" class="pointer-events-none absolute pb-safe-b" bind:offsetHeight={inset}
	></span>

	<!-- The strip, not the pill, is the target: a 3.5rem bar is a thing to look at, and a
			     full-width row is a thing to catch. Lowered, its reach grows down over the faded
			     editor to the whole peek. `touch-action: none` because the pane behind scrolls
			     vertically and would otherwise win the gesture it is being pulled off. -->
	<button
		type="button"
		aria-label={open ? 'Lower the set editor' : 'Raise the set editor'}
		aria-expanded={open}
		onclick={tap}
		onpointerdown={dragStart}
		onpointermove={dragMove}
		onpointerup={dragEnd}
		onpointercancel={dragEnd}
		class={[
			'relative z-10 grid w-full shrink-0 touch-none place-items-center py-2 focus-ring-inset',
			'press:bg-hover',
			!open && 'after:absolute after:inset-x-0 after:top-0 after:h-11'
		]}
		{@attach press()}
	>
		<span
			aria-hidden="true"
			class={[
				'h-1.5 w-14 rounded-full bg-line',
				mediumMs() > 0 && 'transition-transform duration-(--dur-medium) ease-(--ease-medium)',
				!open && 'translate-y-[11px]'
			]}
		></span>
	</button>

	<!-- `pb-safe-b`: with the tab bar gone from this screen, the tray is the bottommost
			     thing and owes the home-indicator inset the bar used to absorb. -->
	<div
		inert={!open}
		class={[
			'pb-safe-b',
			mediumMs() > 0 && 'transition-opacity duration-(--dur-medium) ease-(--ease-medium)',
			!open && !dragging && 'opacity-0'
		]}
	>
		<div class="mx-auto flex w-full max-w-xl flex-col px-3 pt-1 pb-3">
			{#if cursor !== null && meta !== undefined}
				<!-- Keyed so each set gets a fresh editor: what it captures on opening — the
				     recalled numbers, the previews — belongs to the set it opened on. -->
				{#key cursor.set.id}
					<ActiveSet
						{cursor}
						{history}
						{meta}
						{leg}
						{note}
						{hints}
						step={(from, direction) => weightStep(meta.equipment, from, direction)}
						unit={loadUnitLabel(meta)}
						{oncommit}
						{ondraft}
						{onrate}
						{onoptions}
					/>
				{/key}
			{:else}
				<div class="flex items-center gap-3">
					<span
						class="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft
							text-accent-text"
					>
						<Check size={20} />
					</span>

					<div class="flex min-w-0 flex-1 flex-col">
						<span class="truncate text-base font-extrabold tracking-tight text-ink">
							Every set logged
						</span>
						<span class="truncate text-sm font-bold text-ink-faint">
							{total} set{total === 1 ? '' : 's'}
						</span>
					</div>

					<Button variant="commit" compact caps onclick={onfinish}>{finishLabel}</Button>
				</div>
			{/if}
		</div>
	</div>
</div>
