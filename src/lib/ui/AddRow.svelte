<script lang="ts">
	import Plus from '$lib/ui/icons/Plus.svelte';

	type Props = {
		label: string;
		onclick?: () => void;
		secondaryLabel?: string;
		onsecondary?: () => void;
	};

	let { label, onclick, secondaryLabel, onsecondary }: Props = $props();

	// The mark is a glyph and not the `+` character it used to be — the one place
	// the icons' characters-first rule is spent, see `icons/README.md`. A 12px
	// character set in `label-caps` was the same weight as the word beside it, so
	// the row read as two words rather than as an act; at 22 (26 under a thumb)
	// the mark is what the eye lands on and the word is the caption.
	const segment =
		'inline-flex min-h-row items-center justify-center gap-2 focus-ring-inset ' +
		'hover:bg-hover active:bg-surface-2';
</script>

{#if secondaryLabel !== undefined && onsecondary !== undefined}
	<div class="flex rounded-xl border border-dashed border-line text-ink-muted">
		<button type="button" {onclick} class="{segment} flex-1 rounded-l-xl">
			<Plus size={22} />
			<span class="label-caps">{label}</span>
		</button>

		<button
			type="button"
			onclick={onsecondary}
			class="{segment} shrink-0 rounded-r-xl border-l border-dashed border-line px-5"
		>
			<Plus size={22} />
			<span class="label-caps">{secondaryLabel}</span>
		</button>
	</div>
{:else}
	<button
		type="button"
		{onclick}
		class="inline-flex min-h-row items-center justify-center gap-2 rounded-xl border
			border-dashed border-line text-ink-muted focus-ring hover:bg-hover active:bg-surface-2"
	>
		<Plus size={22} />
		<span class="label-caps">{label}</span>
	</button>
{/if}
