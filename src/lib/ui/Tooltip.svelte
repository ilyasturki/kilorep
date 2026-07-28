<script lang="ts" module>
	const trigger =
		'focus-ring inline-grid size-6 shrink-0 place-items-center rounded-full align-middle ' +
		'text-ink-faint hover:text-ink-muted';

	const bubble =
		'z-50 max-w-64 rounded-xl border border-line bg-surface px-3 py-2 ' +
		'text-sm font-bold text-ink shadow-lg';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import { Popover, Tooltip } from 'bits-ui';
	import Info from '$lib/ui/icons/Info.svelte';
	import { coarsePointer } from '$lib/ui/pointer';

	/**
	 * The explanation next to a term that earns one: "est. 1RM" is an Epley
	 * estimate and never the headline PR, volume excludes warmups, per-hand load
	 * counts twice.
	 *
	 * Always hung off a visible ⓘ button, never off bare text. A hint you have
	 * to discover is a hint nobody reads, and long-press is already spent —
	 * PRODUCT.md gives that gesture to the set row's options sheet.
	 *
	 * On a fine pointer this is a real tooltip: hover, or keyboard focus. On a
	 * coarse one it is a Popover, because hover does not exist on a touchscreen
	 * and a control that only responds to an event the device cannot produce is
	 * not a control. Same trigger, same bubble, same text — the swap is
	 * structural, which is the one thing CSS cannot do, so it is made in JS
	 * against the single `coarsePointer` read the numpad already uses.
	 *
	 * ⓘ is drawn rather than typed: U+24D8 is absent from the latin subset,
	 * measured, so the icons README's "characters first" rule sends us to
	 * Phosphor for this one.
	 */
	type Props = {
		text: string;
		children: Snippet;
		class?: ClassValue;
	};

	let { text, children, class: klass }: Props = $props();
</script>

<!-- The mark and the bubble body are the same on both branches; only which
     primitive wraps them differs, so they are written once. -->
{#snippet mark()}
	<Info size={16} />
{/snippet}

<span class={['inline-flex items-center gap-1', klass]}>
	{@render children()}

	{#if coarsePointer}
		<Popover.Root>
			<Popover.Trigger class={trigger} aria-label="More information">
				{@render mark()}
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content sideOffset={6} class={bubble}>
					{text}
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	{:else}
		<!-- `Tooltip.Provider` is in the root layout, not here: it is per-app
		     state, and one per instance means one window scroll listener per ⓘ. -->
		<Tooltip.Root>
			<Tooltip.Trigger class={trigger} aria-label="More information">
				{@render mark()}
			</Tooltip.Trigger>
			<Tooltip.Portal>
				<Tooltip.Content sideOffset={6} class={bubble}>
					{text}
				</Tooltip.Content>
			</Tooltip.Portal>
		</Tooltip.Root>
	{/if}
</span>
