<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import { ToggleGroup } from 'bits-ui';

	type Props = {
		value?: string | string[];
		type?: 'single' | 'multiple';
		layout?: 'grid' | 'line' | 'wrap' | 'row';
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
