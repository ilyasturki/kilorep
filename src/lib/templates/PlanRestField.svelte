<script lang="ts">
	import { MAX_REST_SECONDS, restLabel } from '$lib/domain/rest';
	import { restSettings } from '$lib/settings/rest.svelte';
	import { steppedRest } from '$lib/templates/plan';
	import type { PlanRest } from '$lib/templates/plan';
	import { press } from '$lib/ui/press';
	import ArrowCounterClockwise from '$lib/ui/icons/ArrowCounterClockwise.svelte';
	import BellSlash from '$lib/ui/icons/BellSlash.svelte';

	type Props = {
		rest: PlanRest;
		/** Whose rest, for the controls' names: "after Bench Press", "in this plan". */
		subject: string;
		/** The ledger's footprint: 28px arms and icon actions, for a fine pointer in a grid cell. */
		dense?: boolean;
		onchange: (seconds: number | null | undefined) => void;
	};

	let { rest, subject, dense = false, onchange }: Props = $props();

	const shown = $derived(rest.seconds === null ? 'Off' : restLabel(rest.seconds * 1000));

	const fallback = $derived(rest.fallback === null ? 'off' : restLabel(rest.fallback * 1000));

	const step = (direction: 1 | -1) =>
		onchange(steppedRest(rest, direction, restSettings.current.seconds));

	const arm = $derived(
		dense
			? 'grid size-7 shrink-0 place-items-center rounded-lg bg-sunken text-base font-semibold ' +
					'text-ink-muted focus-ring hover:bg-surface-2 hover:text-ink press:bg-surface-2 ' +
					'press:text-ink disabled:opacity-40'
			: 'grid size-11 shrink-0 place-items-center rounded-xl bg-sunken text-xl font-semibold ' +
					'text-ink-muted focus-ring hover:bg-hover press:bg-surface-2 press:text-ink ' +
					'disabled:opacity-40'
	);

	const act = $derived(
		dense
			? 'grid size-7 shrink-0 place-items-center rounded-lg text-ink-faint focus-ring ' +
					'hover:bg-sunken hover:text-ink-muted'
			: 'grid min-h-11 shrink-0 place-items-center rounded-xl px-2.5 text-sm font-extrabold ' +
					'tracking-caps text-ink-muted focus-ring hover:bg-hover press:bg-surface-2'
	);
</script>

<span class={['flex items-center', dense ? 'gap-1.5' : 'gap-1']}>
	<button
		type="button"
		aria-label="Shorten rest {subject}"
		disabled={rest.seconds === null}
		onclick={() => step(-1)}
		class={arm}
		{@attach press()}
	>
		−
	</button>

	<span
		class={[
			'text-center font-extrabold tracking-numeral tabular-nums',
			dense ? 'min-w-11 text-base' : 'min-w-14 text-lg',
			rest.stated ? 'text-ink' : 'text-ink-faint'
		]}
	>
		{shown}
	</span>

	<button
		type="button"
		aria-label="Lengthen rest {subject}"
		disabled={rest.seconds !== null && rest.seconds >= MAX_REST_SECONDS}
		onclick={() => step(1)}
		class={arm}
		{@attach press()}
	>
		+
	</button>

	<!-- One slot, the same width whatever it holds, so the arms never move under a thumb that
	     is still tapping them: the way back once the plan has said something, the way to off
	     while it has not. -->
	<span class={['grid shrink-0 place-items-center', dense ? 'size-7' : 'w-20']}>
		{#if rest.stated}
			<button
				type="button"
				aria-label="Back to the default rest {subject}, {fallback}"
				onclick={() => onchange(undefined)}
				class={act}
				{@attach press()}
			>
				{#if dense}
					<ArrowCounterClockwise size={15} />
				{:else}
					DEFAULT
				{/if}
			</button>
		{:else if rest.seconds !== null}
			<button
				type="button"
				aria-label="No rest {subject}"
				onclick={() => onchange(null)}
				class={act}
				{@attach press()}
			>
				{#if dense}
					<BellSlash size={15} />
				{:else}
					OFF
				{/if}
			</button>
		{/if}
	</span>
</span>
