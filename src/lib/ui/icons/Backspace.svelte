<script lang="ts">
	// The design draws this key as the character ⌫ (U+232B). Our Nunito build is
	// the latin subset and does not contain it, so it renders as tofu — measured
	// in Chrome, not guessed. It was always a glyph; this is the glyph.
	type Props = {
		size?: number;
		class?: string;
	};

	let { size = 24, class: klass }: Props = $props();
</script>

<svg
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill="none"
	aria-hidden="true"
	class={klass}
	focusable="false"
>
	<path
		d="M8.5 4.5H20a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H8.5L2.5 12z"
		stroke="currentColor"
		stroke-width="1.8"
		stroke-linejoin="round"
	/>
	<path
		d="M11.5 9.5 16.5 14.5M16.5 9.5 11.5 14.5"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
	/>
</svg>
