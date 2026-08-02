<script lang="ts">
	// Body map, Glutes. Two cheeks straddling the spine channel, their gap
	// continuing it. The one region that only exists on the back figure.
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
	<ellipse cx="111" cy="163" rx="14" ry="13" />
	<ellipse cx="145" cy="163" rx="14" ry="13" />
</svg>
