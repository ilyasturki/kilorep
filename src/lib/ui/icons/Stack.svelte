<script lang="ts">
	// The session-overview glyph: three bars, the last one short.
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
	fill="currentColor"
	aria-hidden="true"
	class={klass}
	focusable="false"
>
	<rect x="2" y="5" width="20" height="2.5" rx="1.25" />
	<rect x="2" y="10.75" width="20" height="2.5" rx="1.25" />
	<rect x="2" y="16.5" width="13" height="2.5" rx="1.25" />
</svg>
