<script lang="ts">
	type Props = {
		label: string;
		onclick?: () => void;
		secondaryLabel?: string;
		onsecondary?: () => void;
	};

	let { label, onclick, secondaryLabel, onsecondary }: Props = $props();

	const segment =
		'grid min-h-row place-items-center focus-ring-inset hover:bg-hover active:bg-surface-2';
</script>

{#if secondaryLabel !== undefined && onsecondary !== undefined}
	<div class="flex rounded-xl border border-dashed border-line text-ink-muted">
		<button type="button" {onclick} class="{segment} flex-1 rounded-l-xl">
			<span class="label-caps">+ {label}</span>
		</button>

		<button
			type="button"
			onclick={onsecondary}
			class="{segment} shrink-0 rounded-r-xl border-l border-dashed border-line px-5"
		>
			<span class="label-caps">+ {secondaryLabel}</span>
		</button>
	</div>
{:else}
	<button
		type="button"
		{onclick}
		class="grid min-h-row place-items-center rounded-xl border border-dashed border-line
			text-ink-muted focus-ring hover:bg-hover active:bg-surface-2"
	>
		<span class="label-caps">+ {label}</span>
	</button>
{/if}
