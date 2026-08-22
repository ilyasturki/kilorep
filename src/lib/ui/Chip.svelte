<script lang="ts" module>
	// Selected is a ring and an accent label, not a saturated fill. That settles a measured problem
	// the fill had: white on the dark accent is 3.76:1, fine for a
	// button label and short of AA for a 16px chip. Accent-on-surface is 5.26:1 light, 5.89:1 dark.
	// `ring`, not `border`: a box-shadow costs no layout, so the chip does not shift as it toggles.
	// The fill has to be `surface` rather than the well's `sunken` — these sit directly on a card,
	// with no well to rise out of, so the ring is what gives the selected chip its shape.
	const chip =
		'inline-flex min-h-chip items-center justify-center rounded-xl ' +
		'text-base font-bold select-none focus-ring ' +
		'bg-sunken text-ink-muted ' +
		'data-[state=on]:bg-surface data-[state=on]:text-accent-text ' +
		'data-[state=on]:ring-[1.5px] data-[state=on]:ring-accent-text ' +
		// Scoped to the off state so it cannot race the selected fill: Tailwind resolves
		// conflicts by stylesheet order, not by order in the class attribute.
		'data-[state=off]:hover:bg-hover ' +
		'data-[state=off]:press:bg-surface-2 press-sink ' +
		'pointer-fine:transition-[background-color,color] pointer-fine:duration-100 ' +
		'disabled:pointer-events-none disabled:opacity-50';

	const token = 'min-w-14 shrink-0 px-3';

	const column = 'min-w-0 flex-1 px-1';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ToggleGroup } from 'bits-ui';
	import { press } from '$lib/ui/press';

	type Props = {
		value: string;
		column?: boolean;
		'aria-label'?: string;
		children: Snippet;
	};

	let { value, column: fills = false, 'aria-label': label, children }: Props = $props();
</script>

<ToggleGroup.Item {value} aria-label={label}>
	{#snippet child({ props })}
		<button {...props} class={[chip, fills ? column : token]} {@attach press()}>
			{@render children()}
		</button>
	{/snippet}
</ToggleGroup.Item>
