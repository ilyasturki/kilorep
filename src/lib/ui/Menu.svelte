<script lang="ts">
	import type { Snippet } from 'svelte';
	import { DropdownMenu } from 'bits-ui';
	import Sheet from '$lib/ui/Sheet.svelte';
	import { registerOverlay } from '$lib/ui/overlays';
	import { coarsePointer } from '$lib/ui/pointer';

	/**
	 * A short stack of verbs about one thing: what stands behind every ⋯ in the
	 * app.
	 *
	 * Two elements and the pointer picks one, the same split Tooltip makes and
	 * for the same reason: no stylesheet swaps a component. On a touch device
	 * this is Sheet — the drawer, the scrim, the flick that dismisses it —
	 * because the verbs must land where a thumb is, not where the ⋯ happens to
	 * sit. Where there is a mouse the verbs open under the ⋯ that asked for
	 * them, anchored by Floating UI and wearing `overlay-menu`, the same skin
	 * Select's list wears from `sm` up: a pointer that can be parked anywhere
	 * reads a menu at the question, and dimming the page to show three verbs is
	 * a modal answer to a question that is not one.
	 *
	 * Pointer and not viewport, unlike Sheet's own split: a narrow window on a
	 * desk still has a mouse, and a wide tablet still has thumbs. `coarsePointer`
	 * is the predicate the numpad already trusts.
	 *
	 * `anchor` is an element rather than a Trigger part because every options
	 * menu in the app is one instance per screen addressed by id — a menu per
	 * row would be a portal per row. The ⋯ that was clicked arrives with the
	 * open call, and Bits UI hangs the content off it via `customAnchor`.
	 */
	type Props = {
		open?: boolean;
		/** Names the thing the verbs act on. The sheet titles itself with it; the menu carries it as its accessible name. */
		title: string;
		/** The element the anchored menu hangs from — the ⋯ that opened it. The sheet ignores it. */
		anchor?: HTMLElement | null;
		children: Snippet;
	};

	let { open = $bindable(false), title, anchor = null, children }: Props = $props();

	// Hardware back closes the menu before it navigates — a fine pointer and a
	// hardware back button coexist on a tablet with a mouse. The sheet branch
	// registers through Sheet itself. See `ui/overlays.ts`.
	$effect(() => {
		if (coarsePointer || !open) {
			return;
		}
		return registerOverlay(() => (open = false));
	});
</script>

{#if coarsePointer}
	<Sheet bind:open {title}>
		<div class="flex flex-col gap-2">
			{@render children()}
		</div>
	</Sheet>
{:else}
	<DropdownMenu.Root bind:open>
		<DropdownMenu.Portal>
			<!-- `align="end"`: the ⋯ holds the right edge of whatever it belongs to,
			     so the menu falls flush with that edge rather than jutting into the
			     row. Floating UI flips both axes when the viewport objects. -->
			<DropdownMenu.Content
				customAnchor={anchor}
				sideOffset={6}
				align="end"
				aria-label={title}
				class="overlay-menu min-w-52 p-2"
			>
				{@render children()}
			</DropdownMenu.Content>
		</DropdownMenu.Portal>
	</DropdownMenu.Root>
{/if}
