<script lang="ts">
	// Body map, Back. The lats: wide at the armpit, tapering to the waist. Shaped rather than
	// blocked so it cannot be mistaken for Chest one section above it, which the
	// spine channel alone would leave too close a call.
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
	<path d="M90,60 h32 v64 h-14 a18,18 0 0 1 -16,-11 l-10,-40 a9,9 0 0 1 8,-13 z" />
	<path d="M166,60 h-32 v64 h14 a18,18 0 0 0 16,-11 l10,-40 a9,9 0 0 0 -8,-13 z" />
</svg>
