<script lang="ts">
	import ArrowCounterClockwise from '$lib/ui/icons/ArrowCounterClockwise.svelte';
	import Check from '$lib/ui/icons/Check.svelte';
	import More from '$lib/ui/icons/More.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';
	import SetMark from '$lib/ui/SetMark.svelte';
	import type { SetStatus } from '$lib/ui/SetMark.svelte';
	import { mediumMs } from '$lib/ui/motion';
	import { coarsePointer } from '$lib/ui/pointer';
	import { press, SLOP } from '$lib/ui/press';

	type Props = {
		status: SetStatus;
		index?: number;
		weight: number | null;
		reps: number | null;
		right?: string | null;
		/** What one gesture would log — absent, the row cannot be quick-logged. */
		quick?: { weight: number; reps: number } | null;
		onselect?: () => void;
		onquick?: () => void;
		/**
		 * Takes a logged row back to owed, keeping its numbers. The same rightward pull as
		 * logging, because it is the same axis of the same act — a row that has nothing left
		 * to log is the only row that offers it.
		 */
		onunlog?: () => void;
		/** Takes the row out of the session. Leftward; absent, the row cannot be swiped away. */
		onremove?: () => void;
		onoptions?: (anchor: HTMLElement) => void;
	};

	let {
		status,
		index,
		weight,
		reps,
		right,
		quick = null,
		onselect,
		onquick,
		onunlog,
		onremove,
		onoptions
	}: Props = $props();

	const show = (n: number | null) => (n === null ? '–' : String(n));

	const numerals = $derived(
		{
			done: 'text-ink',
			active: 'text-accent-text',
			pending: 'text-ink-faint',
			warmup: 'text-ink-muted'
		}[status]
	);

	// The swipe. Same intent test as every horizontal gesture here: vertical wins past SLOP,
	// a clear sideways pull captures the pointer. The row travels over a track that says what
	// release will do; the dashed check is the same act for a tap or a mouse.

	/** Rightward: log what the row shows, or — with nothing left to log — take the log back. */
	const forward = $derived.by((): 'log' | 'unlog' | null => {
		if (quick !== null && onquick !== undefined) {
			return 'log';
		}

		return onunlog === undefined ? null : 'unlog';
	});

	const back = $derived(onremove === undefined ? null : 'remove');

	let width = $state(0);

	// The reveal has to finish the sentence it starts. A track that stops mid-word is the
	// gesture asking the lifter to guess, which is what a flat 150px cap did to `Log 100 × 12`
	// — so each cap is its own label's measured width, and only then bounded by the row.
	let forwardLabel = $state(0);
	let backLabel = $state(0);

	const REST = 8;
	const LEAST = 96;

	function capFor(label: number, offered: boolean): number {
		return offered && width > 0 ? Math.min(Math.max(label + REST, LEAST), width * 0.75) : 0;
	}

	const forwardCap = $derived(capFor(forwardLabel, forward !== null));
	const backCap = $derived(capFor(backLabel, back !== null));

	/** px per ms of flick that settles from anywhere in the pull. */
	const FLING = 0.5;

	const SETTLE_AT = 0.6;

	let drag: { id: number; x0: number; y0: number; x: number; at: number; v: number } | null = null;

	let pull = $state(0);
	let pulling = $state(false);
	let swallow = false;

	const clamp = (dx: number) => Math.max(-backCap, Math.min(dx, forwardCap));

	function swipeStart(event: PointerEvent) {
		swallow = false;

		if (!coarsePointer || !event.isPrimary || (forwardCap === 0 && backCap === 0)) {
			drag = null;
			return;
		}

		drag = {
			id: event.pointerId,
			x0: event.clientX,
			y0: event.clientY,
			x: event.clientX,
			at: event.timeStamp,
			v: 0
		};
	}

	function swipeMove(event: PointerEvent & { currentTarget: HTMLElement }) {
		if (drag === null || event.pointerId !== drag.id) {
			return;
		}

		const span = event.timeStamp - drag.at;

		if (span > 0) {
			drag.v = (event.clientX - drag.x) / span;
			drag.x = event.clientX;
			drag.at = event.timeStamp;
		}

		const dx = event.clientX - drag.x0;
		const dy = Math.abs(event.clientY - drag.y0);

		if (pulling) {
			pull = clamp(dx);
			return;
		}

		if (dy > SLOP && dy > Math.abs(dx)) {
			drag = null;
			return;
		}

		if (Math.abs(dx) <= SLOP || Math.abs(dx) <= 2 * dy) {
			return;
		}

		// A direction with nothing behind it is refused rather than clamped to zero: the row
		// would otherwise swallow a pointer it has no use for, and with it the pane's own pan.
		if (dx > 0 ? forwardCap === 0 : backCap === 0) {
			drag = null;
			return;
		}

		event.currentTarget.setPointerCapture(drag.id);
		pulling = true;
		pull = clamp(dx);
	}

	function swipeEnd() {
		if (drag === null || !pulling) {
			drag = null;
			return;
		}

		const went = pull;
		const cap = went > 0 ? forwardCap : backCap;
		const settles =
			Math.abs(went) >= cap * SETTLE_AT || (went > 0 ? drag.v > FLING : drag.v < -FLING);

		drag = null;
		pulling = false;
		swallow = true;
		pull = 0;

		if (!settles || went === 0) {
			return;
		}

		if (went < 0) {
			onremove?.();
			return;
		}

		if (forward === 'log') {
			onquick?.();
			return;
		}

		onunlog?.();
	}

	function swipeClick(event: MouseEvent) {
		if (!swallow) {
			return;
		}

		swallow = false;
		event.preventDefault();
		event.stopImmediatePropagation();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	data-swipe-row
	bind:clientWidth={width}
	onpointerdown={swipeStart}
	onpointermove={swipeMove}
	onpointerup={swipeEnd}
	onpointercancel={swipeEnd}
	onclickcapture={swipeClick}
	class="relative touch-pan-y overflow-hidden"
	{@attach press(() => onoptions)}
>
	<!-- `invisible` rather than a `{#if}`: the label is what sizes the cap, and a track that
	     only exists once the pull has begun would be measured a frame after it was needed. -->
	{#if forward !== null}
		<div
			aria-hidden="true"
			class={[
				'absolute inset-0 flex items-center bg-accent text-on-accent',
				pull <= 0 && 'invisible'
			]}
		>
			<span
				bind:clientWidth={forwardLabel}
				class="flex shrink-0 items-center gap-2 px-4 text-base font-extrabold"
			>
				{#if forward === 'log' && quick !== null}
					<Check size={20} />
					Log {quick.weight} × {quick.reps}
				{:else}
					<ArrowCounterClockwise size={20} />
					Unlog
				{/if}
			</span>
		</div>
	{/if}

	{#if back !== null}
		<div
			aria-hidden="true"
			class={[
				'absolute inset-0 flex items-center justify-end bg-danger-soft text-danger',
				pull >= 0 && 'invisible'
			]}
		>
			<span
				bind:clientWidth={backLabel}
				class="flex shrink-0 items-center gap-2 px-4 text-base font-extrabold"
			>
				Remove
				<Trash size={20} />
			</span>
		</div>
	{/if}

	<!-- The hover reads on the whole row — trailing buttons included — so a fine pointer sees
	     one target, and each button answers its own hover a shade deeper. -->
	<div
		class={[
			'flex items-stretch',
			status === 'active' ? 'bg-accent-soft' : 'bg-surface',
			status !== 'active' &&
				onselect !== undefined &&
				'pointer-fine:transition-[background-color] pointer-fine:duration-100 pointer-fine:hover:bg-hover',
			status === 'warmup' && 'opacity-[0.72]',
			!pulling && pull === 0 && mediumMs() > 0 && 'transition-transform duration-(--dur-small)'
		]}
		style={pull === 0 ? undefined : `transform: translateX(${pull}px)`}
	>
		<svelte:element
			this={onselect === undefined ? 'div' : 'button'}
			type={onselect === undefined ? undefined : 'button'}
			onclick={onselect}
			class={[
				'flex min-h-row-dense min-w-0 flex-1 items-center gap-3 py-1.5 pl-3 text-left',
				onselect !== undefined && 'focus-ring-inset press:bg-surface-2',
				onselect !== undefined && status === 'active' && 'hover:bg-hover',
				onselect !== undefined && 'pointer-fine:transition-[background-color]',
				onselect !== undefined && 'pointer-fine:duration-100'
			]}
		>
			<SetMark {status} {index} />

			<span class="grid shrink-0 grid-cols-[3.25rem_1.25rem_2.5rem] items-baseline">
				<span class="text-right text-base font-extrabold {numerals}">{show(weight)}</span>
				<span class="text-center text-sm font-bold text-ink-faint">×</span>
				<span class="text-right text-base font-extrabold {numerals}">{show(reps)}</span>
			</span>

			{#if right}
				<span class="min-w-0 flex-1 truncate text-right text-sm font-bold text-ink-faint">
					{right}
				</span>
			{/if}
		</svelte:element>

		{#if quick !== null && onquick !== undefined}
			<button
				type="button"
				aria-label="Log {quick.weight} × {quick.reps} as planned"
				onclick={onquick}
				class="grid w-12 shrink-0 place-items-center focus-ring-inset
					hover:bg-surface-2 press:bg-surface-2"
				{@attach press()}
			>
				<span
					class="grid size-7 place-items-center rounded-full border-[1.5px] border-dashed
						border-accent text-accent-text"
				>
					<Check size={14} />
				</span>
			</button>
		{:else}
			<!-- Held on every pointer so the right-hand labels line up across rows: a completed
			     row's word ends where the active row's does, check button or not. -->
			<span class="w-12 shrink-0"></span>
		{/if}

		<!-- A fine pointer cannot long-press, so it keeps its own way into the options. -->
		{#if onoptions !== undefined}
			<button
				type="button"
				aria-label="Set options"
				onclick={(e) => onoptions?.(e.currentTarget)}
				class="hidden w-11 shrink-0 place-items-center text-ink-faint focus-ring-inset
					hover:bg-surface-2 hover:text-ink-muted pointer-fine:grid
					pointer-fine:transition-[background-color,color] pointer-fine:duration-100"
			>
				<More size={20} />
			</button>
		{/if}
	</div>
</div>
