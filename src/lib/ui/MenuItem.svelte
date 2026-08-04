<script lang="ts" module>
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
