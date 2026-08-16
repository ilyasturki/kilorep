<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog } from 'bits-ui';
	import { Drawer } from 'vaul-svelte';
	import Button from '$lib/ui/Button.svelte';
	import type { Pane } from '$lib/ui/keyboard';
	import { dockBottom, keyboardUp, visiblePane, watchVisiblePane } from '$lib/ui/keyboard';
	import { registerOverlay } from '$lib/ui/overlays';
	import { wideViewport } from '$lib/ui/viewport';

	type Props = {
		open?: boolean;
		title: string;
		description?: string;
		action?: Snippet;
		children: Snippet;
		footer?: Snippet;
	};

	let { open = $bindable(false), title, description, action, children, footer }: Props = $props();

	$effect(() => (open ? registerOverlay(() => (open = false)) : undefined));

	let panel = $state<HTMLElement | null>(null);

	// Vaul's own `repositionInputs` is the bug this replaces: it writes an inline height
	// measured against a lazily captured, never-cleared value, restoring a stale size.
	$effect(() => {
		if (!open || panel === null) {
			return;
		}

		const node = panel;

		const dock = (pane: Pane): void => {
			if (keyboardUp(pane)) {
				node.style.setProperty('--sheet-keys', `${dockBottom(pane)}px`);
				node.style.setProperty('--sheet-pane', `${pane.height}px`);
			} else {
				node.style.removeProperty('--sheet-keys');
				node.style.removeProperty('--sheet-pane');
			}

			// A settled drag leaves vaul's inline `transition: transform`, which clobbers the
			// stylesheet's `bottom`/`max-height` legs; clearing it hands the rule back.
			node.style.removeProperty('transition');
		};

		dock(visiblePane());

		return watchVisiblePane(dock);
	});
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
		<div class="flex shrink-0 items-center gap-1">
			{#if action}
				{@render action()}
			{/if}

			{#if closable}
				<Dialog.Close>
					{#snippet child({ props })}
						<Button {...props} variant="chrome" caps>CLOSE</Button>
					{/snippet}
				</Dialog.Close>
			{/if}
		</div>
	</div>
{/snippet}

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
	<Drawer.Root bind:open repositionInputs={false}>
		<Drawer.Portal>
			<Drawer.Overlay class="overlay-scrim-drawer" />

			<Drawer.Content bind:ref={panel} class="overlay-panel overlay-drawer">
				<Drawer.Handle class="mt-3" />
				{@render header(false)}
				{@render body()}
			</Drawer.Content>
		</Drawer.Portal>
	</Drawer.Root>
{/if}
