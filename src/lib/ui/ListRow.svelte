<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import { press } from '$lib/ui/press';

	type Props = {
		title: string;
		match?: { start: number; end: number } | null;
		meta?: string;
		description?: string;
		weight?: 'extrabold' | 'bold';
		href?: string;
		onclick?: () => void;
		onhold?: (anchor: HTMLElement) => void;
		chevron?: boolean;
		tone?: 'default' | 'danger';
		dense?: boolean;
		stacked?: boolean;
		pressed?: boolean;
		leading?: Snippet;
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

	const marker = $derived(chevron ?? interactive);

	// Three explicit elements, not `<svelte:element>`: the dynamic tag defeats the a11y
	// checker, which then assumes the click handler landed on a `<div>` and warns.
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
