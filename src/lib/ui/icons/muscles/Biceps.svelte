<script lang="ts">
	// Body map, Biceps. The upper arms, front. Identical geometry to Triceps — the anterior base
	// is the whole difference, which is why neither renders below 28px.
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
	<rect x="32" y="94" width="38" height="60" rx="19" />
	<rect x="186" y="94" width="38" height="60" rx="19" />
</svg>
