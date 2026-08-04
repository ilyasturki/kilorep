<script lang="ts">
	import type { ClassValue, HTMLInputAttributes } from 'svelte/elements';
	import MagnifyingGlass from '$lib/ui/icons/MagnifyingGlass.svelte';

	/**
	 * Catalog search: inserting an exercise mid-workout, and the Exercises
	 * screen.
	 *
	 * The one field in the library that does not render its label. A magnifier
	 * and a placeholder already say what the control is, and a caps heading over
	 * the search box at the top of a list is vertical space spent on a fact the
	 * user can see. The label still exists — it is the accessible name.
	 *
	 * The clear affordance is `×`, a character rather than an icon, because the
	 * subset carries it (measured: U+00D7 present) and the icons README is
	 * explicit that an icon is what you reach for only when the font cannot
	 * supply the glyph.
	 *
	 * `autocapitalize` and `autocorrect` are off deliberately: an exercise name
	 * is not a sentence, and a phone keyboard that capitalises "bench" or
	 * corrects "Romanian" mid-query costs a whole search.
	 */
	type Props = Omit<HTMLInputAttributes, 'value' | 'class' | 'type'> & {
		/** Accessible name. Not rendered — the magnifier and placeholder are the label. */
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
		// Focus goes back to the field rather than being lost to `<body>`: the
		// only reason to clear a search is to type a different one.
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
				hover:bg-hover active:bg-surface-2"
		>
			×
		</button>
	{/if}
</div>
