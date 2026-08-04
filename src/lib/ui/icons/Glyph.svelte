<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		size = 24,
		class: klass,
		children
	}: { size?: number; class?: string; children: Snippet } = $props();
</script>

<svg
	data-glyph
	viewBox="0 0 256 256"
	width={size}
	height={size}
	fill="currentColor"
	aria-hidden="true"
	class={klass}
	focusable="false"
>
	{@render children()}
</svg>
