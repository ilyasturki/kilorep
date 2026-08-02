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
	<path
		d="M91,56 C86,72 87,90 95,108 C99,116 107,119 117,119 L123,119 L123,58
		C112,55 101,55 91,56 Z"
	/>
	<path
		d="M165,56 C170,72 169,90 161,108 C157,116 149,119 139,119 L133,119 L133,58
		C144,55 155,55 165,56 Z"
	/>
</svg>
