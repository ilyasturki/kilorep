<script lang="ts" module>
	const chip =
		'inline-flex min-h-chip min-w-14 items-center justify-center rounded-xl px-3 ' +
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
