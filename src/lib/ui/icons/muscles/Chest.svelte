<script lang="ts">
	// Body map, Chest. The pec block, the widest lit region in the family and
	// the easiest to read at any size.
	//
	// Original geometry, not Phosphor — see README.md for why the family exists
	// and what a new member has to match. The figure itself lives in
	// `BodyFront.svelte`; this file is the lit region and nothing else.
	import BodyFront from './BodyFront.svelte';

	type Props = {
		size?: number;
		class?: string;
	};

	let { size = 24, class: klass }: Props = $props();
</script>

<svg
	viewBox="0 0 256 256"
	width={size}
	height={size}
	fill="currentColor"
	aria-hidden="true"
	class={klass}
	focusable="false"
>
	<BodyFront />
	<path
		d="M102,54 H154 a24,24 0 0 1 24,24 v16 a30,30 0 0 1 -30,30 h-40 a30,30 0 0 1 -30,-30 v-16 a24,24 0 0 1 24,-24 z"
	/>
</svg>
