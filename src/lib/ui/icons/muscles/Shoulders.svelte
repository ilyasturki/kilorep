<script lang="ts">
	// Body map, Shoulders. Both delt caps. The only region that sits outside the
	// trunk without being on a limb, so it reads instantly.
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
	<ellipse cx="74" cy="64" rx="14" ry="13" />
	<ellipse cx="182" cy="64" rx="14" ry="13" />
</svg>
