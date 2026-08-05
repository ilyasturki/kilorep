<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import { press } from '$lib/ui/press';

	type Props = {
		title: string;
		match?: { start: number; end: number } | null;
		meta?: string;
		href?: string;
		onclick?: () => void;
		onhold?: (anchor: HTMLElement) => void;
		chevron?: boolean;
		/** `danger` colours the title alone: a destructive row is still a row. */
		tone?: 'default' | 'danger';
		dense?: boolean;
		stacked?: boolean;
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
		onhold,
		chevron,
		tone = 'default',
		dense = false,
		stacked = false,
		pressed,
		leading,
		trailing,
		class: klass
	}: Props = $props();

	const interactive = $derived(Boolean(href || onclick));

	// A chevron says "this goes somewhere", so unasked it follows whether the
	// row does. Said outright it is believed either way: a row can be inert and
	// still be the thing you press, when what carries the press is a backdrop
	// beneath it rather than the row itself.
	const marker = $derived(chevron ?? interactive);

	// Three explicit elements rather than one `<svelte:element>`: the dynamic
	// form compiles to a tag the a11y checker cannot see, so it has to assume
	// the click handler landed on a `<div>` and warns. Spelling out the anchor
	// and the button says the same thing to the compiler that the props already
	// say to a reader.
	const shape = $derived([
		'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left',
		dense ? 'min-h-row-dense' : 'min-h-row',
		interactive && 'focus-ring hover:bg-hover press:bg-surface-2 press-sink',
		interactive && 'pointer-fine:transition-[background-color] pointer-fine:duration-100',
		klass
	]);
</script>

{#snippet body()}
	{#if leading}
		<span class="flex shrink-0 items-center text-ink-muted">{@render leading()}</span>
	{/if}

	<!-- Title and meta share one line, and the title never yields for it: the
	     meta is allowed to wrap, and a single line's worth of height clips the
	     line it wraps to, so a name that leaves no room beside it simply takes
	     the row alone. That is the whole mechanism — flexbox breaks the line
	     before an item that will not fit, and `overflow` decides whether the
	     break is visible. No measuring, no breakpoint, and the answer follows
	     the actual name rather than a guess at how long a name gets.

	     A clipped meta is painted nowhere but still read aloud, which is the
	     trade, and it is only a fair one where the meta is a glance's
	     convenience — a last set, a date. `stacked` is for the rows where the
	     meta is the substance instead and dropping it would lose the only copy:
	     it keeps the line of its own that a fact deserves. Reach for it on that
	     test alone, never to buy a long title more room. -->
	<span
		class={[
			'flex min-w-0 flex-1 gap-x-2 text-base',
			stacked
				? 'flex-col'
				: 'max-h-[calc(var(--text-base)*var(--text-base--line-height))] flex-wrap' +
					' items-baseline overflow-hidden'
		]}
	>
		<span
			class={[
				'min-w-0 truncate font-extrabold tracking-tight',
				tone === 'danger' ? 'text-danger' : 'text-ink'
			]}
		>
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
			<span class={['text-sm font-bold text-ink-faint', stacked ? 'truncate' : 'shrink-0']}>
				{meta}
			</span>
		{/if}
	</span>

	{#if trailing}
		<span class="flex shrink-0 items-center gap-2 text-md font-extrabold text-ink-muted">
			{@render trailing()}
		</span>
	{/if}

	{#if marker}
		<span aria-hidden="true" class="shrink-0 text-xl leading-none text-ink-faint">›</span>
	{/if}
{/snippet}

{#if href}
	<a {href} data-list-row class={shape} {@attach press(() => onhold)}>{@render body()}</a>
{:else if onclick}
	<button
		type="button"
		data-list-row
		aria-pressed={pressed}
		{onclick}
		class={shape}
		{@attach press(() => onhold)}
	>
		{@render body()}
	</button>
{:else}
	<div data-list-row class={shape}>{@render body()}</div>
{/if}
