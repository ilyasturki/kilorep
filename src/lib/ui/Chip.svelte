<script lang="ts" module>
	// `shrink-0` because a chip is a token and not a column: in the scrolling
	// `row` layout a flex item would otherwise give up its width to fit, and
	// eleven muscles would arrive squeezed to the `min-w` floor with the longer
	// names broken across two lines instead of scrolling. Nothing to the grid,
	// where flex sizing does not apply, and nothing to `wrap`, where a chip that
	// does not fit moves to the next line rather than narrowing.
	const chip =
		'inline-flex min-h-chip min-w-14 shrink-0 items-center justify-center rounded-xl px-3 ' +
		'text-base font-extrabold select-none focus-ring ' +
		'bg-sunken text-ink-muted ' +
		// Selected is the one place a chip carries the accent as a fill, so it
		// gets on-accent ink with it.
		'data-[state=on]:bg-accent data-[state=on]:text-on-accent ' +
		// Scoped to the off state so it cannot race the selected fill: Tailwind
		// resolves conflicts by stylesheet order, not by which variant is "more
		// specific" in the class attribute.
		'data-[state=off]:hover:bg-surface-2 data-[state=on]:hover:bg-accent-hover ' +
		'pointer-fine:transition-[background-color,color] pointer-fine:duration-100 ' +
		'disabled:pointer-events-none disabled:opacity-50';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import { ToggleGroup } from 'bits-ui';

	type Props = {
		value: string;
		disabled?: boolean;
		class?: ClassValue;
		children: Snippet;
	};

	let { value, disabled = false, class: klass, children }: Props = $props();
</script>

<ToggleGroup.Item {value} {disabled} class={[chip, klass]}>
	{@render children()}
</ToggleGroup.Item>
