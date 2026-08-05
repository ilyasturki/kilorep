<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import { ToggleGroup } from 'bits-ui';

	type Props = {
		value?: string | string[];
		type?: 'single' | 'multiple';
		layout?: 'grid' | 'line' | 'rungs' | 'wrap' | 'row';
		label?: string;
		class?: ClassValue;
		children: Snippet;
	};

	let {
		value = $bindable(),
		type = 'single',
		layout = 'wrap',
		label,
		class: klass,
		children
	}: Props = $props();

	const shapes: Record<NonNullable<Props['layout']>, string> = {
		grid: 'grid grid-cols-4 gap-2',
		line: 'flex gap-1',
		// `line` that folds under a thumb. Eight chips share the width of a
		// logging card, which on a 360px phone is about 30px each — a 52px target
		// standing on a 30px base, and the RPE row was the one place in the loop
		// where the chip you got was not reliably the chip you aimed at. Four
		// columns doubles the base and costs one row of height.
		//
		// `pointer-fine:` and not `sm:`, because the problem is a thumb and not a
		// narrow window: a phone-width browser at a desk has a cursor and does not
		// need the fold. The variant is emitted after the plain utility, so `flex`
		// wins over `grid` at a fine pointer; `grid-cols-4` stays in the class list
		// and is inert on a flex container.
		rungs: 'grid grid-cols-4 gap-2 pointer-fine:flex pointer-fine:gap-1',
		wrap: 'flex flex-wrap gap-2',
		row: 'flex gap-2 overflow-x-auto py-1.5 -my-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
	};

	const shape = $derived([shapes[layout], klass]);
</script>

{#if type === 'multiple'}
	<ToggleGroup.Root
		type="multiple"
		bind:value={() => (Array.isArray(value) ? value : []), (next) => (value = next)}
		aria-label={label}
		class={shape}
	>
		{@render children()}
	</ToggleGroup.Root>
{:else}
	<ToggleGroup.Root
		type="single"
		bind:value={() => (typeof value === 'string' ? value : ''), (next) => (value = next)}
		aria-label={label}
		class={shape}
	>
		{@render children()}
	</ToggleGroup.Root>
{/if}
