<script lang="ts">
	// Body map, Forearms. The lower arms, elbow to wrist, stopping short of the hands so the pair
	// stays distinct from Biceps above it.
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
	<rect x="24" y="148" width="34" height="60" rx="17" />
	<rect x="198" y="148" width="34" height="60" rx="17" />
</svg>
