<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import { press } from '$lib/ui/press';

	type Props = {
		title: string;
		match?: { start: number; end: number } | null;
		meta?: string;
		/**
		 * A line under the name that says what the row does, for the rows whose
		 * control is a choice rather than a destination. Unlike `meta` it wraps
		 * rather than truncates: a sentence is not a glance's convenience, and
		 * half of one is worse than a taller row.
		 */
		description?: string;
		/**
		 * The name's weight. `extrabold` is the list's own voice and the default;
		 * `bold` is for a row that stands beside controls carrying their own label,
		 * where the heavier name would read as a heading over them.
		 */
		weight?: 'extrabold' | 'bold';
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
		/**
		 * A marker that belongs to the name rather than to the row — a PR pill, a
		 * state. It rides with the title, inside the line the meta wraps out of,
		 * which is what parts it from `trailing`: that group holds the row's
		 * values and is read right to left.
		 */
		badge?: Snippet;
		trailing?: Snippet;
		class?: ClassValue;
	};

	let {
		title,
		match = null,
		meta,
		description,
		weight = 'extrabold',
		href,
		onclick,
		onhold,
		chevron,
		tone = 'default',
		dense = false,
		stacked = false,
		pressed,
		leading,
		badge,
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
	<span class="flex min-w-0 flex-1 flex-col">
		<span
			class={[
				'flex min-w-0 gap-x-2 text-base',
				stacked
					? 'flex-col'
					: 'max-h-[calc(var(--text-base)*var(--text-base--line-height))] flex-wrap' +
						' items-baseline overflow-hidden'
			]}
		>
			<span
				class={[
					'min-w-0 truncate tracking-tight',
					weight === 'bold' ? 'font-bold' : 'font-extrabold',
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
			{#if badge}
				<span class="flex shrink-0 items-center">{@render badge()}</span>
			{/if}
			{#if meta}
				<span class={['text-sm font-bold text-ink-faint', stacked ? 'truncate' : 'shrink-0']}>
					{meta}
				</span>
			{/if}
		</span>

		{#if description}
			<span class="text-sm font-bold text-ink-faint">{description}</span>
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
