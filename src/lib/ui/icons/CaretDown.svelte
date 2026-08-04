<script lang="ts">
	// Phosphor `caret-down`, bold.
	let { size = 24, class: klass }: { size?: number; class?: string } = $props();
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
	<path
		d="M216.49,104.49l-80,80a12,12,0,0,1-17,0l-80-80a12,12,0,0,1,17-17L128,159l71.51-71.52a12,12,0,0,1,17,17Z"
	/>
</svg>
