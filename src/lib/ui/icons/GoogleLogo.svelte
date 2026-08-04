<script lang="ts">
	import Glyph from './Glyph.svelte';

	let { size = 24, class: klass }: { size?: number; class?: string } = $props();
</script>

<Glyph {size} class={klass}>
	<path
		d="M228,128a100,100,0,1,1-22.86-63.64,12,12,0,0,1-18.51,15.28A76,76,0,1,0,203.05,140H128a12,12,0,0,1,0-24h88A12,12,0,0,1,228,128Z"
	/>
</Glyph>
