<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		description?: string;
		icon?: Snippet;
		action?: Snippet;
	};

	let { title, description, icon, action }: Props = $props();
</script>

<div class="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
	{#if icon}
		<div class="grid size-14 place-items-center rounded-full bg-surface-2 text-ink-faint">
			{@render icon()}
		</div>
	{/if}

	<div class="flex flex-col gap-1">
		<h2 class="title-panel text-ink">{title}</h2>
		{#if description}
			<p class="max-w-xs text-md font-bold text-ink-faint">{description}</p>
		{/if}
	</div>

	{#if action}
		<div class="w-full pt-1">{@render action()}</div>
	{/if}
</div>
