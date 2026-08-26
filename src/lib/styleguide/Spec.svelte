<script lang="ts">
	import type { Snippet } from 'svelte';

	import { caption, specimen } from '$lib/styleguide/chrome';

	type Props = {
		/** The props that make this specimen the one it is, spelled as they are written. */
		label: string;
		/** The specimen fills the card's width — a field, a row, a button that spans. */
		full?: boolean;
		children: Snippet;
	};

	let { label, full = false, children }: Props = $props();
</script>

<div class={[specimen, full && 'w-full']}>
	{@render children()}
	<span class={caption}>{label}</span>
</div>
