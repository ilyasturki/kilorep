<script lang="ts">
	import type { Component } from 'svelte';

	import Plus from '$lib/ui/icons/Plus.svelte';
	import { press } from '$lib/ui/press';

	/** The icon contract, which is all this row ever asks of a glyph. */
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

	// The mark is a glyph and not the `+` character it used to be — the one place
	// the icons' characters-first rule is spent, see `icons/README.md`. A 12px
	// character set in `label-caps` was the same weight as the word beside it, so
	// the row read as two words rather than as an act; at 24 (26 under a thumb)
	// the mark is what the eye lands on and the word is the caption.
	//
	// Which glyph is the caller's, defaulting to `Plus`. A row that adds one more
	// of what is already listed says so with a plus and nothing else; the two
	// acts a split row offers cannot, because a plus on both halves is one mark
	// drawn twice and the labels end up carrying the whole distinction. See the
	// workout screen, which spends `RowsPlusBottom` and `StackPlus` on it.
	//
	// No sink on the split form: the two halves share a border, and one of them
	// shrinking pulls that seam open.
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
