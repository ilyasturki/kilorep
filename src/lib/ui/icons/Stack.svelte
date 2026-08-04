<script lang="ts">
	import Glyph from './Glyph.svelte';

	let { size = 24, class: klass }: { size?: number; class?: string } = $props();
</script>

<Glyph {size} class={klass}>
	<rect x="40" y="52" width="176" height="24" rx="12" />
	<rect x="40" y="116" width="176" height="24" rx="12" />
	<rect x="40" y="180" width="110" height="24" rx="12" />
</Glyph>
