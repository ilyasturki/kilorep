<script lang="ts">
	// Body map, Calves. The lower legs. Posterior because that is the view a calf is read from,
	// and it keeps the leg pair consistent with Hamstrings above it.
	//
	// Original geometry, not Phosphor — see README.md for why the family exists
	// and what a new member has to match. The figure itself lives in
	// `BodyBack.svelte`; this file is the lit region and nothing else.
	import BodyBack from './BodyBack.svelte';

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
	<BodyBack />
	<rect x="94" y="216" width="31" height="40" rx="15" />
	<rect x="131" y="216" width="31" height="40" rx="15" />
</svg>
