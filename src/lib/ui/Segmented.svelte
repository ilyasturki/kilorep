<script lang="ts" module>
	import type { Component } from 'svelte';

	export type Segment = {
		/** What `value` holds when this one is chosen. For a link, its address. */
		value: string;
		label: string;
		icon?: Component<{ size?: number; class?: string }>;
		/**
		 * Given, the segment is a real anchor and the route owns `value` — pass it
		 * one-way and let navigation move it. Withheld, the segment is a button and
		 * `bind:value` owns it.
		 */
		href?: string;
	};

	// A raised pill on a well, not the accent: the accent means "this logs a set",
	// and `surface` over `sunken` is the depth ramp saying "selected" neutrally in
	// both themes without a per-theme pair.
	//
	// The two states are styled under separate `data-[state=…]` prefixes rather
	// than one plain rule and one override — Tailwind resolves a conflict by
	// stylesheet order, not by how specific a class looks in the attribute, so a
	// bare `text-ink-faint` could win over the selected colour.
	const segment =
		'flex min-h-chrome flex-1 items-center justify-center gap-2 rounded-xl px-2 ' +
		'text-md font-bold select-none focus-ring ' +
		'data-[state=on]:bg-surface data-[state=on]:text-ink ' +
		'data-[state=off]:text-ink-faint data-[state=off]:press:bg-surface-2 ' +
		'data-[state=off]:pointer-fine:hover:text-ink-muted ' +
		'pointer-fine:transition-colors pointer-fine:duration-100';
</script>

<script lang="ts">
	import { Toolbar } from 'bits-ui';

	import { press } from '$lib/ui/press';

	/**
	 * Two or three peers, one of them current — a filter over one destination, not
	 * a way to a different one.
	 *
	 * `Toolbar` and not `ToggleGroup`, which is the primitive a segmented control
	 * looks like it wants: a toggle item spreads `role="radio"` and swallows Enter
	 * to toggle itself, both of which strip an anchor of the thing that makes it
	 * an anchor. `Toolbar.Link` is bits-ui's answer to exactly that — it drops its
	 * `role` when it renders an `<a>` and touches neither click nor Enter — while
	 * `Toolbar.Root` still gives the ARIA toolbar pattern the shape is asking for:
	 * one tab stop for the group, arrow keys between the segments. `data-state` is
	 * ours to set here, because a link's selected state is which address is open.
	 *
	 * Full width, so the segments read as the two halves of the screen below them
	 * rather than as a control sitting in a corner of it.
	 *
	 * `data-sveltekit-replacestate` on the group rather than per link, which
	 * SvelteKit honours from any ancestor: a segment is a filter, so pushing an
	 * entry would make browser back undo a tap on the web, and where both halves
	 * are tab roots — Plan's are — Android back would answer the same tap by
	 * quitting the app.
	 */
	type Props = {
		items: readonly Segment[];
		value?: string;
		/** Names the group; a toolbar with no label is an unnamed one. */
		label?: string;
	};

	let { items, value = $bindable(''), label }: Props = $props();
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
	class="flex w-full gap-1 rounded-2xl bg-sunken p-1"
>
	{#each items as item (item.value)}
		{@const state = item.value === value ? 'on' : 'off'}

		<!-- No `press-sink`: a segment that shrinks inside a fixed well reads as a
		     glitch, the same call the tab bar makes. The tint is the whole feedback. -->
		{#if item.href === undefined}
			<Toolbar.Button onclick={() => (value = item.value)}>
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
