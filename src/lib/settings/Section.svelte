<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		/** Beside the heading, for the one act the section has that no row owns. */
		action?: Snippet;
		/** The rows, each in its own `<li>`. */
		children: Snippet;
		/** Under the card: the sentence that explains it, and any live region. */
		footer?: Snippet;
	};

	let { title, action, children, footer }: Props = $props();
</script>

<!--
	The prose is under the card rather than above it on purpose: a leading
	paragraph puts a wall of text between the heading and the control it
	describes, which on a phone is the whole first screen spent on explanation.
	The rows say what they are; the footer is for what a row cannot.
-->
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
