<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import { Popover, Tooltip } from 'bits-ui';

	import { bubble } from '$lib/ui/Tooltip.svelte';
	import { coarsePointer } from '$lib/ui/pointer';
	import { press } from '$lib/ui/press';

	type Props = {
		/** Said aloud and shown on demand: the button's name, not a hint about it. */
		label: string;
		onclick: () => void;
		class?: ClassValue;
		children: Snippet;
	};

	let { label, onclick, class: klass, children }: Props = $props();

	/**
	 * A button whose whole label is a glyph, and the two ways to ask what it is.
	 *
	 * `aria-label` was already the answer for anyone who cannot see it. What
	 * this adds is the answer for someone who can — a Phosphor archive box and
	 * a Phosphor stack are the same drawing at 20px until you have met both.
	 *
	 * The two pointers get different machinery because they are asking
	 * different questions. A cursor hovers, and hovering is free: `Tooltip`
	 * opens on the provider's 150ms delay and closes when the cursor leaves. A
	 * finger has no hover at all, and a tap has to *do* the thing — so the
	 * label rides the 500ms hold instead, the same gesture that opens a row's
	 * menu everywhere else, and `press` swallows the click that ends it. Ask
	 * what the button is and it does not do it; the two are never one act.
	 */
	let open = $state(false);
	let anchor = $state<HTMLElement | null>(null);

	function reveal(element: HTMLElement): void {
		anchor = element;
		open = true;
	}
</script>

{#if coarsePointer}
	<button type="button" aria-label={label} {onclick} class={klass} {@attach press(() => reveal)}>
		{@render children()}
	</button>

	<Popover.Root bind:open>
		<Popover.Portal>
			<Popover.Content customAnchor={anchor} sideOffset={6} class={bubble}>
				{label}
			</Popover.Content>
		</Popover.Portal>
	</Popover.Root>
{:else}
	<!-- The trigger *is* the button, not a wrapper around one — `Tooltip.Trigger`
	     renders a `<button type="button">` by default and merges what it is
	     handed, so the click handler and the classes land on the real element
	     and nothing extra is introduced into the layout to hang a bubble on. -->
	<Tooltip.Root>
		<Tooltip.Trigger aria-label={label} {onclick} class={klass}>
			{@render children()}
		</Tooltip.Trigger>
		<Tooltip.Portal>
			<Tooltip.Content sideOffset={6} class={bubble}>{label}</Tooltip.Content>
		</Tooltip.Portal>
	</Tooltip.Root>
{/if}
