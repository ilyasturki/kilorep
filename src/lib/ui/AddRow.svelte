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
	};

	let {
		label,
		onclick,
		icon: Icon = Plus,
		secondaryLabel,
		onsecondary,
		secondaryIcon: SecondaryIcon = Plus
	}: Props = $props();

	const segment =
		'inline-flex min-h-row items-center justify-center gap-2 focus-ring-inset ' +
		'hover:bg-hover press:bg-surface-2';
</script>

{#if secondaryLabel !== undefined && onsecondary !== undefined}
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
