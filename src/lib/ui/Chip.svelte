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

	const token = 'min-w-14 shrink-0 px-3';

	const column = 'min-w-0 flex-1 px-1';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ToggleGroup } from 'bits-ui';

	type Props = {
		value: string;
		column?: boolean;
		'aria-label'?: string;
		children: Snippet;
	};

	let { value, column: fills = false, 'aria-label': label, children }: Props = $props();
</script>

<ToggleGroup.Item {value} aria-label={label} class={[chip, fills ? column : token]}>
	{@render children()}
</ToggleGroup.Item>
