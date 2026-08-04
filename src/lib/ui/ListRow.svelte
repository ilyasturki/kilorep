<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	type Props = {
		title: string;
		match?: { start: number; end: number } | null;
		meta?: string;
		href?: string;
		onclick?: () => void;
		chevron?: boolean;
		dense?: boolean;
		pressed?: boolean;
		leading?: Snippet;
		trailing?: Snippet;
		class?: ClassValue;
	};

	let {
		title,
		match = null,
		meta,
		href,
		onclick,
		chevron = true,
		dense = false,
		pressed,
		leading,
		trailing,
		class: klass
	}: Props = $props();

	const interactive = $derived(Boolean(href || onclick));

	// Three explicit elements rather than one `<svelte:element>`: the dynamic
	// form compiles to a tag the a11y checker cannot see, so it has to assume
	// the click handler landed on a `<div>` and warns. Spelling out the anchor
	// and the button says the same thing to the compiler that the props already
	// say to a reader.
	const shape = $derived([
		'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left',
		dense ? 'min-h-row-dense' : 'min-h-row',
		interactive && 'focus-ring hover:bg-hover active:bg-surface-2',
		interactive && 'pointer-fine:transition-[background-color] pointer-fine:duration-100',
		klass
	]);
</script>

{#snippet body()}
	{#if leading}
		<span class="flex shrink-0 items-center text-ink-muted">{@render leading()}</span>
	{/if}

	<span class="min-w-0 flex-1">
		<span class="block truncate text-base font-extrabold tracking-tight text-ink">
			<!-- One line on purpose: whitespace between the slices would render. -->
			{#if match !== null}
				{title.slice(0, match.start)}<mark
					class="bg-transparent text-inherit underline decoration-2 underline-offset-2"
					>{title.slice(match.start, match.end)}</mark
				>{title.slice(match.end)}
			{:else}
				{title}
			{/if}
		</span>
		{#if meta}
			<span class="block truncate text-sm font-bold text-ink-faint">{meta}</span>
		{/if}
	</span>

	{#if trailing}
		<span class="flex shrink-0 items-center gap-2 text-md font-extrabold text-ink-muted">
			{@render trailing()}
		</span>
	{/if}

	{#if interactive && chevron}
		<span aria-hidden="true" class="shrink-0 text-xl leading-none text-ink-faint">›</span>
	{/if}
{/snippet}

{#if href}
	<a {href} data-list-row class={shape}>{@render body()}</a>
{:else if onclick}
	<button type="button" data-list-row aria-pressed={pressed} {onclick} class={shape}>
		{@render body()}
	</button>
{:else}
	<div data-list-row class={shape}>{@render body()}</div>
{/if}
