<script lang="ts">
	// Phosphor `google-logo`, bold. Provenance and the rules for adding one: README.md.
	//
	// Phosphor's mark rather than Google's four-colour one, which keeps this in the
	// family the rest of the app draws from: one weight, one optical size,
	// `currentColor`. It also avoids shipping a trademark that may only be
	// reproduced exactly, in a codebase where every other icon inherits its colour
	// from a parent.
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
		d="M228,128a100,100,0,1,1-22.86-63.64,12,12,0,0,1-18.51,15.28A76,76,0,1,0,203.05,140H128a12,12,0,0,1,0-24h88A12,12,0,0,1,228,128Z"
	/>
</svg>
