<script lang="ts">
	import type { Component } from 'svelte';

	import Plus from '$lib/ui/icons/Plus.svelte';
	import { press } from '$lib/ui/press';

	type Mark = Component<{ size?: number; class?: string }>;

	type Props = {
		label: string;
		onclick?: () => void;
		icon?: Mark;
		secondaryLabel?: string;
		onsecondary?: () => void;
		secondaryIcon?: Mark;
		/** A row of the list it adds to: no box, a row's height, squared inside a `list-group`. */
		flush?: boolean;
	};

	let {
		label,
		onclick,
		icon: Icon = Plus,
		secondaryLabel,
		onsecondary,
		secondaryIcon: SecondaryIcon = Plus,
		flush = false
	}: Props = $props();

	const segment =
		'inline-flex min-h-row items-center justify-center gap-2 focus-ring-inset ' +
		'hover:bg-hover press:bg-surface-2';

	const row =
		'flex min-h-row-dense items-center gap-3 py-1.5 focus-ring-inset hover:bg-hover ' +
		'press:bg-surface-2 pointer-fine:transition-[background-color] pointer-fine:duration-100';
</script>

{#if flush}
	<div data-list-row class="flex overflow-hidden rounded-xl text-ink-muted">
		<button
			type="button"
			{onclick}
			data-ripple
			class="{row} min-w-0 flex-1 pr-3 pl-3 text-left"
			{@attach press()}
		>
			<span class="grid w-8 shrink-0 place-items-center"><Icon size={20} /></span>
			<span class="truncate label-caps">{label}</span>
		</button>

		{#if secondaryLabel !== undefined && onsecondary !== undefined}
			<button
				type="button"
				onclick={onsecondary}
				data-ripple
				class="{row} shrink-0 border-l border-line-soft px-4"
				{@attach press()}
			>
				<SecondaryIcon size={20} />
				<span class="label-caps">{secondaryLabel}</span>
			</button>
		{/if}
	</div>
{:else if secondaryLabel !== undefined && onsecondary !== undefined}
	<div class="flex rounded-xl border border-dashed border-line text-ink-muted">
		<button type="button" {onclick} class="{segment} flex-1 rounded-l-xl" {@attach press()}>
			<Icon size={24} />
			<span class="label-caps">{label}</span>
		</button>

		<button
			type="button"
			onclick={onsecondary}
			class="{segment} shrink-0 rounded-r-xl border-l border-dashed border-line px-5"
			{@attach press()}
		>
			<SecondaryIcon size={24} />
			<span class="label-caps">{secondaryLabel}</span>
		</button>
	</div>
{:else}
	<button
		type="button"
		{onclick}
		class="inline-flex min-h-row press-sink items-center justify-center gap-2 rounded-xl border
			border-dashed border-line text-ink-muted focus-ring hover:bg-hover press:bg-surface-2"
		{@attach press()}
	>
		<Icon size={24} />
		<span class="label-caps">{label}</span>
	</button>
{/if}
