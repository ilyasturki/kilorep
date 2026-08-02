<script lang="ts">
	// Body map, Chest. Two pec mounds meeting at the sternum, spanning nearly
	// the full chest width so the band still reads at 28px.
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
	<ellipse cx="108" cy="80" rx="19" ry="14" transform="rotate(-6 108 80)" />
	<ellipse cx="148" cy="80" rx="19" ry="14" transform="rotate(6 148 80)" />
</svg>
