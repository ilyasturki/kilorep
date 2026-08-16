<script lang="ts" module>
	import type { Component } from 'svelte';

	export type Segment = {
		value: string;
		label: string;
		icon?: Component<{ size?: number; class?: string }>;
		// Given, the segment is an anchor and the route owns `value`; withheld, `bind:value` does.
		href?: string;
	};

	// Both states under `data-[state=…]` prefixes: Tailwind resolves conflicts by stylesheet
	// order, so a bare `text-ink-faint` could win over the selected colour.
	const segment =
		'segmented-item relative flex min-h-chrome flex-1 items-center justify-center gap-2 ' +
		'rounded-xl px-2 text-md font-bold select-none focus-ring ' +
		'data-[state=on]:text-ink ' +
		'data-[state=off]:text-ink-faint data-[state=off]:press:bg-surface-2 ' +
		'data-[state=off]:pointer-fine:hover:text-ink-muted';
</script>

<script lang="ts">
	import { Toolbar } from 'bits-ui';

	import { press } from '$lib/ui/press';

	// `Toolbar`, not `ToggleGroup`: a toggle item spreads `role="radio"` and swallows Enter,
	// both of which break the real anchors this renders.
	type Props = {
		items: readonly Segment[];
		value?: string;
		label?: string;
		onchange?: (value: string) => void;
	};

	let { items, value = $bindable(''), label, onchange }: Props = $props();

	const index = $derived(items.findIndex((item) => item.value === value));

	function pick(next: string) {
		if (next === value) {
			return;
		}

		value = next;
		onchange?.(next);
	}
</script>

{#snippet body(item: Segment)}
	{#if item.icon}
		{@const Icon = item.icon}
		<Icon size={18} class="shrink-0" />
	{/if}
	<span class="truncate">{item.label}</span>
{/snippet}

<Toolbar.Root
	aria-label={label}
	data-sveltekit-replacestate
	style="--seg-count: {items.length}; --seg-index: {index}"
	class="segmented-well rounded-2xl bg-sunken"
>
	{#if index !== -1}
		<span aria-hidden="true" class="segmented-pill rounded-xl bg-surface"></span>
	{/if}

	{#each items as item (item.value)}
		{@const state = item.value === value ? 'on' : 'off'}

		{#if item.href === undefined}
			<Toolbar.Button onclick={() => pick(item.value)}>
				{#snippet child({ props })}
					<button {...props} type="button" data-state={state} class={segment} {@attach press()}>
						{@render body(item)}
					</button>
				{/snippet}
			</Toolbar.Button>
		{:else}
			<Toolbar.Link>
				{#snippet child({ props })}
					<a
						{...props}
						href={item.href}
						aria-current={state === 'on' ? 'page' : undefined}
						data-state={state}
						class={segment}
						{@attach press()}
					>
						{@render body(item)}
					</a>
				{/snippet}
			</Toolbar.Link>
		{/if}
	{/each}
</Toolbar.Root>
