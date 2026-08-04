<script lang="ts">
	// Phosphor `play`, fill. The active half of the pair `Play.svelte` opens — see
	// the README on why fill is the partner of bold and never a second family.
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
		d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z"
	/>
</svg>
