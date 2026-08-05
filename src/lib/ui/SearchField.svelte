<script lang="ts">
	import type { ClassValue, HTMLInputAttributes } from 'svelte/elements';
	import MagnifyingGlass from '$lib/ui/icons/MagnifyingGlass.svelte';
	import { press } from '$lib/ui/press';

	type Props = Omit<HTMLInputAttributes, 'value' | 'class' | 'type'> & {
		label: string;
		value?: string;
		class?: ClassValue;
	};

	let {
		label,
		value = $bindable(''),
		placeholder = 'Search',
		class: klass,
		...rest
	}: Props = $props();

	let field = $state<HTMLInputElement>();

	function clear() {
		value = '';
		field?.focus();
	}
</script>

<div class={['relative', klass]}>
	<MagnifyingGlass
		size={18}
		class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint"
	/>

	<input
		{...rest}
		bind:this={field}
		bind:value
		{placeholder}
		type="search"
		aria-label={label}
		enterkeyhint="search"
		autocomplete="off"
		autocapitalize="off"
		autocorrect="off"
		spellcheck={false}
		class="field-box min-h-row border-line pr-12 pl-11 focus-ring
			[&::-webkit-search-cancel-button]:hidden"
	/>

	{#if value}
		<button
			type="button"
			aria-label="Clear search"
			onclick={clear}
			class="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full
				text-xl leading-none font-bold text-ink-muted focus-ring
				hover:bg-hover press:bg-surface-2"
			{@attach press()}
		>
			×
		</button>
	{/if}
</div>
