<script lang="ts" module>
	import type { SetStatus } from '$lib/ui/SetMark.svelte';

	const styles: Record<SetStatus, { shell: string; numerals: string; times: string }> = {
		warmup: {
			shell: 'min-h-14 rounded-xl bg-surface border border-dashed border-line opacity-[0.72]',
			numerals: 'text-lg text-ink-muted',
			times: 'text-md'
		},
		done: {
			shell: 'min-h-row rounded-xl bg-surface border border-line-soft',
			numerals: 'text-xl text-ink',
			times: 'text-base'
		},
		active: {
			shell: 'card-active min-h-24',
			numerals: 'text-3xl tracking-numeral text-ink',
			times: 'text-lg'
		},
		pending: {
			shell: 'min-h-row rounded-xl border border-dashed border-line',
			numerals: 'text-xl text-ink-faint',
			times: 'text-base'
		}
	};

	const numeralGrid =
		'grid grid-cols-[5rem_1.375rem_2.5rem] items-baseline justify-start font-extrabold ' +
		'@md:grid-cols-[6.5rem_1.625rem_3.5rem]';

	const show = (n: number | null | undefined) => (n === null || n === undefined ? '–' : String(n));
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import SetMark from '$lib/ui/SetMark.svelte';
	import More from '$lib/ui/icons/More.svelte';
	import { press } from '$lib/ui/press';

	type Props = {
		status: SetStatus;
		index?: number;
		weight?: number | null;
		reps?: number | null;
		right?: Snippet;
		onselect?: () => void;
		onoptions?: (anchor: HTMLElement) => void;
	};

	let { status, index, weight, reps, right, onselect, onoptions }: Props = $props();

	const style = $derived(styles[status]);

	const interactive = $derived(Boolean(onselect));
</script>

<!--
	The press lives on the shell rather than the button inside it. The ⋯ is a
	sibling holding the right edge, so a tint on the button alone would light two
	thirds of a row — and the class the recognizer toggles, unlike `:active`,
	does not travel up to ancestors on its own. Pointer and click events do bubble
	up to here from the button, which is what lets one attachment cover both.
-->
<div
	class={[
		'@container relative grid grid-cols-[1fr_auto] items-center overflow-hidden',
		style.shell,
		interactive && 'press-sink hover:bg-hover press:bg-surface-2',
		interactive && 'pointer-fine:transition-[background-color] pointer-fine:duration-100'
	]}
	{@attach press(() => onoptions)}
>
	{#if status === 'active'}
		<div class="absolute inset-y-0 left-0 w-1.5 bg-accent-text" aria-hidden="true"></div>
	{/if}

	<button
		type="button"
		onclick={onselect}
		class="grid h-full w-full grid-cols-[2rem_1fr_auto] items-center gap-3 py-2 pr-3
			pl-4 text-left focus-ring-inset"
	>
		<SetMark {status} {index} />

		<div class="{numeralGrid} {style.numerals}">
			<span class="text-right">{show(weight)}</span>
			<span class="text-center font-bold text-ink-faint {style.times}">×</span>
			<span class="text-right">{show(reps)}</span>
		</div>

		<div class="text-sm font-bold text-ink-faint">
			{@render right?.()}
		</div>
	</button>

	{#if onoptions}
		<button
			type="button"
			aria-label="Set options"
			onclick={(e) => onoptions?.(e.currentTarget)}
			class="mr-2 hidden size-9 shrink-0 place-items-center rounded-lg text-lg text-ink-faint
				focus-ring hover:bg-sunken hover:text-ink-muted pointer-fine:grid
				pointer-fine:transition-[background-color,color] pointer-fine:duration-100"
		>
			<More size={20} />
		</button>
	{/if}
</div>
