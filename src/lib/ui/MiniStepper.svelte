<script lang="ts">
	import type { ClassValue } from 'svelte/elements';
	import { press } from '$lib/ui/press';

	type Props = {
		label: string;
		value: string;
		dim?: boolean;
		ondec: (() => void) | null;
		oninc: (() => void) | null;
		class?: ClassValue;
	};

	let { label, value, dim = false, ondec, oninc, class: klass }: Props = $props();

	const arm =
		'grid w-11 shrink-0 place-items-center text-xl font-semibold text-ink-muted ' +
		'focus-ring-inset select-none hover:bg-hover press:bg-surface-2 press:text-ink ' +
		'disabled:pointer-events-none disabled:opacity-40';
</script>

{#snippet end(verb: string, on: (() => void) | null, corner: string, glyph: string)}
	<button
		type="button"
		aria-label="{verb} {label}"
		disabled={on === null}
		onclick={on ?? undefined}
		class="{arm} {corner}"
		{@attach press()}
	>
		{glyph}
	</button>
{/snippet}

<div
	role="group"
	aria-label={label}
	class={['flex min-h-11 items-stretch rounded-xl bg-sunken', klass]}
>
	{@render end('Lower', ondec, 'rounded-l-xl', '−')}

	<span
		class={[
			'flex min-w-0 flex-1 items-center justify-center truncate px-1 text-md',
			dim ? 'font-bold text-ink-faint' : 'font-extrabold tracking-numeral text-ink'
		]}
	>
		{value}
	</span>

	{@render end('Raise', oninc, 'rounded-r-xl', '+')}
</div>
