<script lang="ts">
	import Check from '$lib/ui/icons/Check.svelte';
	import More from '$lib/ui/icons/More.svelte';
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
	// a clear rightward pull captures the pointer. The row travels over an accent track that
	// says what release will do; the dashed check is the same act for a tap or a mouse.
	let width = $state(0);

	const cap = $derived(Math.min(150, width * 0.4));

	/** px per ms of rightward flick that logs from anywhere. */
	const FLING = 0.5;

	const SETTLE_AT = 0.6;

	let drag: { id: number; x0: number; y0: number; x: number; at: number; v: number } | null = null;

	let pull = $state(0);
	let pulling = $state(false);
	let swallow = false;

	function swipeStart(event: PointerEvent) {
		swallow = false;

		if (!coarsePointer || quick === null || onquick === undefined || !event.isPrimary) {
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
			pull = Math.max(0, Math.min(dx, cap));
			return;
		}

		if (dy > SLOP && dy > dx) {
			drag = null;
			return;
		}

		if (dx > SLOP && dx > 2 * dy) {
			event.currentTarget.setPointerCapture(drag.id);
			pulling = true;
			pull = Math.min(dx, cap);
		}
	}

	function swipeEnd() {
		if (drag === null || !pulling) {
			drag = null;
			return;
		}

		const logs = pull >= cap * SETTLE_AT || drag.v > FLING;

		drag = null;
		pulling = false;
		swallow = true;
		pull = 0;

		if (logs) {
			onquick?.();
		}
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
	bind:clientWidth={width}
	onpointerdown={swipeStart}
	onpointermove={swipeMove}
	onpointerup={swipeEnd}
	onpointercancel={swipeEnd}
	onclickcapture={swipeClick}
	class="relative touch-pan-y overflow-hidden"
	{@attach press(() => onoptions)}
>
	{#if quick !== null}
		<div
			aria-hidden="true"
			class={[
				'absolute inset-0 flex items-center gap-2 bg-accent pl-4',
				'text-base font-extrabold text-on-accent',
				pull === 0 && 'invisible'
			]}
		>
			<Check size={20} />
			Log {quick.weight} × {quick.reps}
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
