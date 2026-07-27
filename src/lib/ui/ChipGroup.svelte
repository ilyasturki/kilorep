<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ToggleGroup } from 'bits-ui';
	import { cn } from '$lib/ui/cn';

	/**
	 * Set type, RPE, and any other one-of-N pick. Built on Bits UI's ToggleGroup
	 * rather than a row of buttons for the roving tabindex and arrow-key
	 * navigation — the group is one tab stop, not six, which is the difference
	 * between usable and unusable with a keyboard.
	 */
	type Props = {
		value?: string;
		/** `grid` for the fixed 4-up set-type row, `wrap` for the RPE scale. */
		layout?: 'grid' | 'wrap';
		label?: string;
		class?: string;
		children: Snippet;
	};

	let { value = $bindable(), layout = 'wrap', label, class: klass, children }: Props = $props();
</script>

<ToggleGroup.Root
	type="single"
	bind:value
	aria-label={label}
	class={cn('gap-2', layout === 'grid' ? 'grid grid-cols-4' : 'flex flex-wrap', klass)}
>
	{@render children()}
</ToggleGroup.Root>
