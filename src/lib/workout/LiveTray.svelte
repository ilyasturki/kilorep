<script lang="ts">
	import { REST_NUDGE_SECONDS } from '$lib/domain/rest';
	import { prefillFor } from '$lib/domain/workout';
	import { weightStep } from '$lib/domain/exercise';
	import { loadUnitLabel } from '$lib/exercises/label';
	import type { Exercise } from '$lib/domain/exercise';
	import type { History, SetCursor } from '$lib/domain/workout';
	import Button from '$lib/ui/Button.svelte';
	import { mediumMs } from '$lib/ui/motion';
	import { press, SLOP } from '$lib/ui/press';
	import BellSlash from '$lib/ui/icons/BellSlash.svelte';
	import Check from '$lib/ui/icons/Check.svelte';
	import ActiveSet from '$lib/workout/ActiveSet.svelte';
	import { restTimer } from '$lib/workout/rest.svelte';

	type Props = {
		cursor: SetCursor | null;
		meta: Exercise | undefined;
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
		/** Off when the tray edits a record: no rest is owed for a set lifted weeks ago. */
		rest?: boolean;
		/** Off where last time is beside the point — editing a record older than "last time". */
		hints?: boolean;
		finishLabel?: string;
		/** Tapping the exercise name scrolls the list back to it; absent, the name is inert. */
		onjump?: () => void;
		oncommit: (weight: number, reps: number) => void;
		ondraft: (weight: number | null, reps: number | null) => void;
		onrate: (rpe: number | null) => void;
		onoptions: (anchor: HTMLElement) => void;
		onfinish: () => void;
	};

	let {
		cursor,
		meta,
		note,
		history,
		total,
		open = $bindable(true),
		rest = true,
		hints = true,
		finishLabel = 'FINISH',
		onjump,
		oncommit,
		ondraft,
		onrate,
		onoptions,
		onfinish
	}: Props = $props();

	// The tray is the rest timer's face while it stands: the global bar steps in below once the
	// tray is down, and exactly one of the two owns the tick. 250ms, because a 1s poll would
	// hold a digit for up to two seconds.
	$effect(() => {
		if (!open || !rest || (!restTimer.running && !restTimer.undoing)) {
			return;
		}

		restTimer.tick(Date.now());

		const id = setInterval(() => restTimer.tick(Date.now()), 250);

		return () => clearInterval(id);
	});

	// A backgrounded WebView throttles the interval, leaving `now` stale on the way back.
	function wake() {
		if (open && rest && !document.hidden && (restTimer.running || restTimer.undoing)) {
			restTimer.tick(Date.now());
		}
	}

	// The drag. Only the handle strip takes it: the tray below is nothing but controls, and a
	// pull that started on a stepper would be the lifter reaching for a number, not the edge.
	// Same shape as the row swipe — a captured pointer, a threshold, and a flick that carries.

	/** px per ms of downward flick that lowers the tray from anywhere in the pull. */
	const FLING = 0.5;

	const SETTLE_AT = 0.35;

	let pulled = $state(0);
	let dragging = $state(false);

	// The tray's own height: what the slot above opens to, and how far a pull has to travel.
	// Measured on the tray rather than on the slot — the slot's height is what the collapse
	// animates, and reading the box being animated would be a loop.
	let span = $state(0);

	let drag: { id: number; y0: number; y: number; at: number; v: number } | null = null;
	let swallow = false;

	// While the finger is down the tray travels alone and the list stays where it is; the space
	// is handed over on release, when the row it collapses into is the one that keeps it.
	const shift = $derived(dragging ? pulled : 0);

	function dragStart(event: PointerEvent & { currentTarget: HTMLElement }) {
		// Cleared here rather than after the click: a drag that lowers the tray leaves it inert,
		// so the click it would have swallowed never comes, and a flag left standing would eat
		// the first honest tap the handle gets once the tray is back.
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

		if (!dragging && dy <= SLOP) {
			return;
		}

		dragging = true;

		// Upward is refused rather than clamped to a rubber band: there is nothing above the
		// open tray to pull it into, and a band would promise one.
		pulled = Math.max(0, Math.min(dy, span));
	}

	function dragEnd() {
		if (drag === null) {
			return;
		}

		const dragged = dragging;
		const lowers = dragged && (pulled >= span * SETTLE_AT || drag.v > FLING);

		drag = null;
		dragging = false;
		pulled = 0;

		// A pull that came back is the lifter changing their mind, and the click the browser
		// fires after it would lower the tray they just kept. Only a gesture that never became
		// a drag is still allowed to be a tap — and `lower` reads this rather than a capture
		// listener, which on the target itself would run after the click handler, not before.
		swallow = dragged;

		if (lowers) {
			open = false;
		}
	}

	function lower() {
		if (swallow) {
			swallow = false;

			return;
		}

		open = false;
	}

	// What lifting resumes on when the rest runs out, offered with the numbers the editor
	// would open on — the panel says where the session goes, not just how long it waits.
	const next = $derived.by(() => {
		if (cursor === null || meta === undefined) {
			return null;
		}

		const offer = prefillFor(cursor, history, meta);
		const place = cursor.workingIndex < 0 ? 'warmup' : `set ${cursor.workingIndex + 1}`;
		const numbers =
			offer.weight === null || offer.reps === null ? '' : ` · ${offer.weight} × ${offer.reps}`;

		return `${meta.name} — ${place}${numbers}`;
	});
</script>

<svelte:document onvisibilitychange={wake} />

<!-- Two boxes, and the outer one is why: it is the slot the tray stands in, and animating its
     height from the tray's own down to nothing is the space the list takes back. The tray is
     bottom-anchored inside it and clipped, so a shrinking slot eats the tray from the top and
     it reads as going down past the edge rather than being squashed against it. `height: auto`
     until the first measurement lands, so nothing flashes on the way in.

     `inert` rather than a `{#if}`: the tray stays mounted so the editor keeps the numbers it
     was opened on, and a lowered tray must not answer a tab key or a screen reader. -->
<div
	inert={!open}
	class={[
		'flex shrink-0 flex-col justify-end overflow-hidden',
		!dragging &&
			mediumMs() > 0 &&
			'transition-[height] duration-(--dur-medium) ease-(--ease-medium)'
	]}
	style={span === 0 ? undefined : `height: ${open ? span : 0}px`}
>
	<div
		class={[
			'shrink-0 overflow-hidden rounded-t-sheet border-t border-line bg-surface',
			!dragging &&
				mediumMs() > 0 &&
				'transition-transform duration-(--dur-medium) ease-(--ease-medium)'
		]}
		style={shift === 0 ? undefined : `transform: translateY(${shift}px)`}
		bind:clientHeight={span}
	>
		<!-- The strip, not the pill, is the target: a 3.5rem bar is a thing to look at, and a
			     full-width row is a thing to catch. `touch-action: none` because the pane behind
			     scrolls vertically and would otherwise win the gesture it is being pulled off.
			     The click is the same act for a keyboard or a mouse, which cannot flick. -->
		<button
			type="button"
			aria-label="Lower the set editor"
			onclick={lower}
			onpointerdown={dragStart}
			onpointermove={dragMove}
			onpointerup={dragEnd}
			onpointercancel={dragEnd}
			class="grid w-full shrink-0 touch-none place-items-center py-2 focus-ring-inset
					press:bg-hover"
			{@attach press()}
		>
			<span aria-hidden="true" class="h-1.5 w-14 rounded-full bg-line"></span>
		</button>

		<!-- `pb-safe-b`: with the tab bar gone from this screen, the tray is the bottommost
			     thing and owes the home-indicator inset the bar used to absorb. -->
		<div class="pb-safe-b">
			{#if rest && restTimer.running}
				<div role="timer" aria-label="Rest timer" class="relative">
					<div
						aria-hidden="true"
						class="absolute inset-y-0 left-0 bg-accent-soft
					motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-linear"
						style="width: {(restTimer.progress * 100).toFixed(1)}%"
					></div>

					<div class="relative mx-auto flex w-full max-w-xl flex-col gap-1.5 px-3 py-3">
						<div class="flex items-center gap-2">
							<span
								class={[
									'shrink-0 text-3xl font-extrabold tracking-numeral tabular-nums',
									restTimer.overtime ? 'text-accent-text' : 'text-ink'
								]}
							>
								{restTimer.label}
							</span>

							<span class="min-w-0 flex-1 truncate label-caps">
								{restTimer.exerciseName ?? 'Rest'}
							</span>

							{#snippet nudge(by: number, label: string)}
								<button
									type="button"
									aria-label={label}
									onclick={() => restTimer.nudge(by)}
									class="grid min-h-chip shrink-0 place-items-center rounded-lg bg-sunken px-2
								text-sm font-extrabold text-ink-muted tabular-nums focus-ring
								hover:bg-hover press:bg-surface-2 press:text-ink"
									{@attach press()}
								>
									{by < 0 ? '−' : '+'}{Math.abs(by)}
								</button>
							{/snippet}

							{@render nudge(-REST_NUDGE_SECONDS, `Cut ${REST_NUDGE_SECONDS} seconds`)}
							{@render nudge(REST_NUDGE_SECONDS, `Add ${REST_NUDGE_SECONDS} seconds`)}

							<button
								type="button"
								onclick={() => restTimer.skip()}
								class="grid min-h-chip shrink-0 place-items-center rounded-full border
							border-line px-3.5 text-sm font-extrabold tracking-wide text-accent-text focus-ring
							hover:bg-hover press:bg-surface-2"
								{@attach press()}
							>
								SKIP
							</button>

							<button
								type="button"
								aria-label="No rest for the rest of this session"
								onclick={() => restTimer.mute()}
								class="grid min-h-chip w-9 shrink-0 place-items-center rounded-full
							text-ink-faint focus-ring hover:bg-hover press:bg-surface-2 press:text-ink"
								{@attach press()}
							>
								<BellSlash size={18} />
							</button>
						</div>

						{#if next !== null}
							<div class="flex items-baseline gap-1.5">
								<span class="shrink-0 label-caps">Next</span>
								<span class="min-w-0 truncate text-sm font-bold text-ink-muted">{next}</span>
							</div>
						{/if}
					</div>
				</div>
			{:else}
				<div class="mx-auto flex w-full max-w-xl flex-col px-3 py-3">
					{#if rest && restTimer.undoing}
						<div
							role="status"
							class="-mt-0.5 mb-2 flex items-center gap-2 border-b border-line-soft pb-2"
						>
							<span class="min-w-0 flex-1 truncate label-caps">
								{restTimer.dismissedName ?? 'Rest'} — skipped
							</span>

							<button
								type="button"
								aria-label="Undo skipped rest"
								onclick={() => restTimer.undo()}
								class="grid min-h-chrome shrink-0 place-items-center rounded-full border border-line
							px-3 text-sm font-extrabold tracking-wide text-accent-text focus-ring
							hover:bg-hover press:bg-surface-2"
								{@attach press()}
							>
								UNDO
							</button>
						</div>
					{/if}

					{#if cursor !== null && meta !== undefined}
						<!-- Keyed so each set gets a fresh editor: what it captures on opening — the
				     recalled numbers, the previews — belongs to the set it opened on. -->
						{#key cursor.set.id}
							<ActiveSet
								{cursor}
								{history}
								{meta}
								{note}
								{hints}
								{onjump}
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
			{/if}
		</div>
	</div>
</div>
