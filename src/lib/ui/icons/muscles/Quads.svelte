<script lang="ts">
	// Body map, Quads. The thighs, front. Identical geometry to Hamstrings — again the base is
	// the difference.
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
	<rect x="99" y="165" width="25" height="54" rx="12" />
	<rect x="132" y="165" width="25" height="54" rx="12" />
</svg>
