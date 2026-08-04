<script lang="ts">
	import Glyph from './Glyph.svelte';

	let { size = 24, class: klass }: { size?: number; class?: string } = $props();
</script>

<Glyph {size} class={klass}>
	<path
		d="M144,128a16,16,0,1,1-16-16A16,16,0,0,1,144,128ZM60,112a16,16,0,1,0,16,16A16,16,0,0,0,60,112Zm136,0a16,16,0,1,0,16,16A16,16,0,0,0,196,112Z"
	/>
</Glyph>
