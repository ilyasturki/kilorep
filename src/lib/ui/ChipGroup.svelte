<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import { ToggleGroup } from 'bits-ui';

	/**
	 * Set type, RPE, and any other one-of-N or any-of-N pick. Built on Bits UI's
	 * ToggleGroup rather than a row of buttons for the roving tabindex and
	 * arrow-key navigation — the group is one tab stop, not six, which is the
	 * difference between usable and unusable with a keyboard.
	 *
	 * `type` splits into two roots because the primitive's value is `string` in
	 * one case and `string[]` in the other; that is a discriminated union, not a
	 * prop. Multiple is for a short set whose members should all stay visible —
	 * an exercise's muscle targets. A longer list belongs in Select, which keeps
	 * the same choice behind a sheet.
	 */
	type Props = {
		value?: string | string[];
		type?: 'single' | 'multiple';
		/** `grid` for the fixed 4-up set-type row, `wrap` for the RPE scale. */
		layout?: 'grid' | 'wrap';
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

	const shape = $derived([
		'gap-2',
		layout === 'grid' ? 'grid grid-cols-4' : 'flex flex-wrap',
		klass
	]);
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
