<script lang="ts">
	// Phosphor `arrow-counter-clockwise`, bold. The bare arc, not
	// `ClockCounterClockwise`'s dialled version — that one is History's glyph, and a
	// clock face on Unlog would say the set is being sent somewhere rather than
	// being un-said.
	import Glyph from './Glyph.svelte';

	let { size = 24, class: klass }: { size?: number; class?: string } = $props();
</script>

<Glyph {size} class={klass}>
	<path
		d="M228,128a100,100,0,0,1-98.66,100H128a99.39,99.39,0,0,1-68.62-27.29,12,12,0,0,1,16.48-17.45,76,76,0,1,0-1.57-109c-.13.13-.25.25-.39.37L54.89,92H72a12,12,0,0,1,0,24H24a12,12,0,0,1-12-12V56a12,12,0,0,1,24,0V76.72L57.48,57.06A100,100,0,0,1,228,128Z"
	/>
</Glyph>
