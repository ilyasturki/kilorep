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
		/**
		 * `grid` for the fixed 4-up set-type row, `wrap` for the RPE scale, `row`
		 * for a set too long to wrap where it stands — the eleven muscles under
		 * the picker's search field, which wrapped to three rows and pushed the
		 * first result off a phone.
		 */
		layout?: 'grid' | 'wrap' | 'row';
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

	// `row` pays for its own scroll box. Overflow clips at the padding edge, so a
	// chip flush against the top of one loses the ring `focus-ring` draws
	// outside it — the padding is what gives that ring somewhere to be, and the
	// matching negative margin gives the space straight back to the layout, so a
	// scrolling group sits in a stack exactly where a wrapping one would.
	//
	// No scrollbar: a persistent 15px trough under a 52px chip is most of a
	// second row of chrome, and it would eat the ring room the padding just
	// bought. The half-chip cut off at the edge is the affordance instead, which
	// is what a scrolling chip rail has always used.
	const shapes: Record<NonNullable<Props['layout']>, string> = {
		grid: 'grid grid-cols-4',
		wrap: 'flex flex-wrap',
		row: 'flex overflow-x-auto py-1.5 -my-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
	};

	const shape = $derived(['gap-2', shapes[layout], klass]);
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
