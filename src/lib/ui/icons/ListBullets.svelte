<script lang="ts">
	// Phosphor `list-bullets`, bold. Provenance and the rules for adding one:
	// README.md.
	//
	// The Exercises tab, and the one nav glyph with no fill partner. Phosphor
	// draws `fill` for a line icon as a *boxed* variant — `list-bullets-fill` is
	// a solid rounded square with the bars knocked out of it, not the same
	// silhouette in solid. Beside `BarbellFill`, which is a true solid of its
	// own outline, that reads as a different icon rather than a heavier one, so
	// this tab wears the bold in both states and lets the capsule and the ink
	// carry active on its own. Swapping the glyph for one with a real pair
	// (`books`, `squares-four`) is the alternative, and is a two-line change in
	// `bar.svelte.ts`.
	//
	// Not `Stack`: that is three bars with a short third and already means the
	// workout's session overview. Bullets is what keeps the two apart.
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
	<path
		d="M76,64A12,12,0,0,1,88,52H216a12,12,0,0,1,0,24H88A12,12,0,0,1,76,64Zm140,52H88a12,12,0,0,0,0,24H216a12,12,0,0,0,0-24Zm0,64H88a12,12,0,0,0,0,24H216a12,12,0,0,0,0-24ZM44,112a16,16,0,1,0,16,16A16,16,0,0,0,44,112Zm0-64A16,16,0,1,0,60,64,16,16,0,0,0,44,48Zm0,128a16,16,0,1,0,16,16A16,16,0,0,0,44,176Z"
	/>
</svg>
