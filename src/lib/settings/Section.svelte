<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		action?: Snippet;
		children: Snippet;
		footer?: Snippet;
	};

	let { title, action, children, footer }: Props = $props();
</script>

<section class="flex flex-col gap-2">
	<div class="flex min-h-chrome items-center justify-between gap-3 px-1">
		<h2 class="label-caps">{title}</h2>

		{#if action}
			{@render action()}
		{/if}
	</div>

	<ul class="list-group">
		{@render children()}
	</ul>

	{#if footer}
		<div class="flex flex-col gap-1 px-1">
			{@render footer()}
		</div>
	{/if}
</section>
