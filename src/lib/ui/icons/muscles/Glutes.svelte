<script lang="ts">
	// Body map, Glutes. The pelvic block, in its posterior two-half form. The
	// one region that only exists on the back figure.
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
	<path d="M92,160 h30 v12 a20,20 0 0 1 -20,20 h-10 z" />
	<path d="M164,160 h-30 v12 a20,20 0 0 0 20,20 h10 z" />
</svg>
