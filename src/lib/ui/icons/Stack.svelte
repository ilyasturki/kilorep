<script lang="ts">
	// The session-overview glyph: three bars, the last one short. The one icon
	// with no Phosphor original — `list` is three *equal* bars, and the short
	// third is what makes this read as a summary rather than a menu. So it is
	// redrawn on Phosphor `list` bold's exact geometry (bars 24 tall, fully
	// rounded, inset 40, centred on y 64/128/192) with the third bar cut to 110.
	// In-family by construction: swap the third width back to 176 and this file
	// is byte-equivalent to the real thing.
	type Props = {
		size?: number;
		class?: string;
	};

	let { size = 24, class: klass }: Props = $props();
</script>

<svg
	data-glyph
	viewBox="0 0 256 256"
	width={size}
	height={size}
	fill="currentColor"
	aria-hidden="true"
	class={klass}
	focusable="false"
>
	<rect x="40" y="52" width="176" height="24" rx="12" />
	<rect x="40" y="116" width="176" height="24" rx="12" />
	<rect x="40" y="180" width="110" height="24" rx="12" />
</svg>
