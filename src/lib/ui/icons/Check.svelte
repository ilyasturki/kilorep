<script lang="ts">
	// One of two SVG glyphs in the app. The rest — × and ⌫ — are characters, and
	// there is no icon library by design.
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
		d="M4.5 12.5 9.5 17.5 19.5 6.5"
		stroke="currentColor"
		stroke-width="3"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>
