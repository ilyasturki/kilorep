<script lang="ts">
	import type { ClassValue } from 'svelte/elements';

	/**
	 * A weight or rep field with fat ± on either side of the number.
	 *
	 * The dot above the value is not decoration. PRODUCT.md: the check "commits
	 * exactly what's on screen — the hint/target if untouched, your edits if
	 * touched", and the hint is never silently written. The dot is the only
	 * thing on screen that distinguishes a recalled hint from an affirmative
	 * claim, so it appears the moment the value leaves its prefill and clears
	 * again if you step back onto it.
	 */
	type Props = {
		prefill: number;
		label: string;
		step?: number;
		min?: number;
		onchange?: (value: number) => void;
		class?: ClassValue;
	};

	let { prefill, label, step = 2.5, min = 0, onchange, class: klass }: Props = $props();

	// A derived value can be reassigned, and the override is dropped the moment
	// its dependency changes — which is exactly the rule this field needs: a nudge
	// overrides the hint, and a new prefill (a new set) takes the field back with
	// the touched dot. Written as an effect it needed a shadow copy of `prefill`
	// to stop itself looping; derived, the reset is the framework's job.
	let value = $derived(prefill);

	const touched = $derived(value !== prefill);
	const display = $derived(String(Math.round(value * 100) / 100));

	function nudge(direction: number) {
		value = Math.max(min, Math.round((value + direction * step) * 100) / 100);
		onchange?.(value);
	}
</script>

{#snippet arm(direction: number, verb: string, corner: string)}
	<button
		type="button"
		aria-label="{verb} {label}"
		onclick={() => nudge(direction)}
		class={[
			'grid w-11 shrink-0 place-items-center text-2xl font-semibold focus-ring-inset',
			'text-ink-muted hover:bg-surface-2 active:bg-surface-2 active:text-ink',
			corner
		]}
	>
		{direction < 0 ? '−' : '+'}
	</button>
{/snippet}

<div
	class={['relative flex min-h-19 items-stretch rounded-2xl bg-sunken', klass]}
	role="group"
	aria-label={label}
>
	{#if touched}
		<div class="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
			<div class="size-1.5 rounded-full bg-accent-text"></div>
		</div>
	{/if}

	{@render arm(-1, 'decrease', 'rounded-l-2xl')}

	<div class="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5">
		<div class="text-2xl leading-none font-extrabold tracking-numeral">{display}</div>
		<div class="label-caps">{label}</div>
	</div>

	{@render arm(1, 'increase', 'rounded-r-2xl')}
</div>
