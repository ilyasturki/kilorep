<script lang="ts">
	import type { Snippet } from 'svelte';
	import { DropdownMenu } from 'bits-ui';
	import Sheet from '$lib/ui/Sheet.svelte';
	import { registerOverlay } from '$lib/ui/overlays';
	import { coarsePointer } from '$lib/ui/pointer';

	type Props = {
		open?: boolean;
		title: string;
		anchor?: HTMLElement | null;
		children: Snippet;
	};

	let { open = $bindable(false), title, anchor = null, children }: Props = $props();

	$effect(() => (open && !coarsePointer ? registerOverlay(() => (open = false)) : undefined));
</script>

{#if coarsePointer}
	<Sheet bind:open {title}>
		<div class="flex flex-col gap-2">{@render children()}</div>
	</Sheet>
{:else}
	<DropdownMenu.Root bind:open>
		<DropdownMenu.Portal>
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
