<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog } from 'bits-ui';
	import { Drawer } from 'vaul-svelte';
	import Button from '$lib/ui/Button.svelte';
	import { registerOverlay } from '$lib/ui/overlays';
	import { wideViewport } from '$lib/ui/viewport';

	type Props = {
		open?: boolean;
		title: string;
		description?: string;
		children: Snippet;
		footer?: Snippet;
	};

	let { open = $bindable(false), title, description, children, footer }: Props = $props();

	$effect(() => (open ? registerOverlay(() => (open = false)) : undefined));
</script>

{#snippet header(closable: boolean)}
	<div class="flex items-start justify-between gap-3 px-4 pt-4 pb-0.5">
		<div class="min-w-0">
			<Dialog.Title class="title-panel">{title}</Dialog.Title>
			{#if description}
				<Dialog.Description class="text-sm font-bold text-ink-faint">
					{description}
				</Dialog.Description>
			{/if}
		</div>
		{#if closable}
			<Dialog.Close>
				{#snippet child({ props })}
					<Button {...props} variant="chrome" caps>CLOSE</Button>
				{/snippet}
			</Dialog.Close>
		{/if}
	</div>
{/snippet}

<!-- The 6px of `pt` is not spacing — the header's `pb` was cut by the same
     amount, so the gap under the title is the 8px it always was. A scroll box
     clips at its padding edge, and `focus-ring` draws 2px of outline 2px
     *outside* the control's box, so a focusable sitting flush at the top of
     this one lost the whole top edge of its ring: the picker's search field
     lit up on three sides. Padding is what buys the outline room to exist,
     which is why it belongs here rather than on any one sheet's first child —
     every sheet in the app has a first child, and several of them are
     focusable. -->
{#snippet body()}
	<div class="min-h-0 flex-1 overflow-y-auto px-4 pt-1.5 pb-4">
		{@render children()}
	</div>

	{#if footer}
		<div class="shrink-0 border-t border-line-soft px-4 pt-3">
			{@render footer()}
		</div>
	{/if}
{/snippet}

{#if wideViewport.current}
	<Dialog.Root bind:open>
		<Dialog.Portal>
			<Dialog.Overlay class="overlay-scrim" />

			<Dialog.Content class="overlay-panel overlay-sheet">
				{@render header(true)}
				{@render body()}
			</Dialog.Content>
		</Dialog.Portal>
	</Dialog.Root>
{:else}
	<Drawer.Root bind:open>
		<Drawer.Portal>
			<Drawer.Overlay class="overlay-scrim-drawer" />

			<Drawer.Content class="overlay-panel overlay-drawer">
				<Drawer.Handle class="mt-3" />
				{@render header(false)}
				{@render body()}
			</Drawer.Content>
		</Drawer.Portal>
	</Drawer.Root>
{/if}
