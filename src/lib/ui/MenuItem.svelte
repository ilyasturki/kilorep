<script lang="ts" module>
	/**
	 * One verb in a Menu. Icon leading label, like every options list in the
	 * app: a short stack of verbs is read as a menu, and a menu is scanned by
	 * glyph before it is read.
	 *
	 * The anchored dress echoes `Select.Item` — same height, same radius, same
	 * `data-highlighted` fill — because both are rows in an `overlay-menu` and
	 * should read as the same object. Type and colour come from Button's
	 * secondary and destructive looks instead, so a verb reads the same whether
	 * it landed in the sheet or under the pointer.
	 *
	 * `outline-none` on the anchored shapes: Bits UI moves real focus through
	 * the items and paints it as `data-highlighted`, and a UA focus ring on top
	 * of that fill would be the same state said twice.
	 */
	const item =
		'flex min-h-row w-full select-none items-center gap-3 rounded-xl px-3 outline-none ' +
		'data-highlighted:bg-hover data-disabled:pointer-events-none data-disabled:opacity-50';

	const dress = {
		default: 'text-md font-bold text-ink-muted',
		destructive: 'text-md font-extrabold text-danger'
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { DropdownMenu } from 'bits-ui';
	import Button from '$lib/ui/Button.svelte';
	import { coarsePointer } from '$lib/ui/pointer';

	type Props = {
		destructive?: boolean;
		/**
		 * A verb that is really a place. Rendered as a true anchor in both
		 * dresses — Bits UI dropped `href` from `Item`, so the anchored branch
		 * spreads the item's props onto an `<a>` of ours — because a desk should
		 * be able to middle-click "View exercise".
		 */
		href?: string;
		onselect?: () => void;
		children: Snippet;
	};

	let { destructive = false, href, onselect, children }: Props = $props();

	const paint = $derived(destructive ? dress.destructive : dress.default);
</script>

{#if coarsePointer}
	<Button
		variant={destructive ? 'destructive' : 'secondary'}
		class="w-full"
		{href}
		onclick={onselect}
	>
		{@render children()}
	</Button>
{:else if href !== undefined}
	<DropdownMenu.Item onSelect={onselect}>
		{#snippet child({ props })}
			<a {...props} {href} class="{item} {paint}">
				{@render children()}
			</a>
		{/snippet}
	</DropdownMenu.Item>
{:else}
	<DropdownMenu.Item onSelect={onselect} class="{item} {paint}">
		{@render children()}
	</DropdownMenu.Item>
{/if}
