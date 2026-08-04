<script lang="ts" module>
	const chip =
		'inline-flex min-h-chip items-center justify-center rounded-xl ' +
		'text-base font-extrabold select-none focus-ring ' +
		'bg-sunken text-ink-muted ' +
		'data-[state=on]:bg-accent data-[state=on]:text-on-accent ' +
		// Scoped to the off state so it cannot race the selected fill: Tailwind
		// resolves conflicts by stylesheet order, not by which variant is "more
		// specific" in the class attribute.
		'data-[state=off]:hover:bg-hover data-[state=on]:hover:bg-accent-hover ' +
		'pointer-fine:transition-[background-color,color] pointer-fine:duration-100 ' +
		'disabled:pointer-events-none disabled:opacity-50';

	// `shrink-0` because a chip is a token and not a column: in the scrolling
	// `row` layout a flex item would otherwise give up its width to fit, and
	// eleven muscles would arrive squeezed to the `min-w` floor with the longer
	// names broken across two lines instead of scrolling. Nothing to the grid,
	// where flex sizing does not apply, and nothing to `wrap`, where a chip that
	// does not fit moves to the next line rather than narrowing.
	const token = 'min-w-14 shrink-0 px-3';

	// And the one set that *is* columns: the exertion rungs, which have to stay
	// on one line at any width. Nine tokens are 568px of chip and wrap onto three
	// rows on a phone; nine columns are a ninth of the card each, no floor and no
	// padding to defend, which is what makes the ladder readable in one glance
	// rather than reassembled from three rows.
	const column = 'min-w-0 flex-1 px-1';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import { ToggleGroup } from 'bits-ui';

	type Props = {
		value: string;
		disabled?: boolean;
		/** An equal share of a `line` group's width rather than a token of its own size. */
		column?: boolean;
		/**
		 * For a chip whose content is a glyph. The icons README is explicit that
		 * the accessible name lives on the wrapping control, and this is it.
		 */
		'aria-label'?: string;
		class?: ClassValue;
		children: Snippet;
	};

	let {
		value,
		disabled = false,
		column: fills = false,
		'aria-label': label,
		class: klass,
		children
	}: Props = $props();
</script>

<ToggleGroup.Item
	{value}
	{disabled}
	aria-label={label}
	class={[chip, fills ? column : token, klass]}
>
	{@render children()}
</ToggleGroup.Item>
