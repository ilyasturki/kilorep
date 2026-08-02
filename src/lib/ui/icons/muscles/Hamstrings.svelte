<script lang="ts">
	// Body map, Hamstrings. The thighs, back. Identical geometry to Quads; see the note there.
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
	<rect x="90" y="168" width="35" height="56" rx="17" />
	<rect x="131" y="168" width="35" height="56" rx="17" />
</svg>
