<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import { Dialog } from 'bits-ui';
	import { Drawer } from 'vaul-svelte';
	import Button from '$lib/ui/Button.svelte';
	import { registerOverlay } from '$lib/ui/overlays';
	import { wideViewport } from '$lib/ui/viewport';

	/**
	 * Session overview, set options, anything that slides up over the loop.
	 *
	 * Two elements and the viewport picks one, the same split Select makes and
	 * for the same reason: no stylesheet swaps a component. On a phone this is
	 * a vaul-svelte drawer — the panel follows the finger, and a flick down
	 * dismisses it — because a sheet that only *looks* draggable teaches the
	 * gesture and then ignores it. From `sm` up it stays the Bits UI dialog,
	 * centred by `overlay-sheet`: a mouse does not drag panels off screen.
	 *
	 * Focus trap, scroll lock and dismiss-on-outside come from Bits UI in both
	 * branches — vaul-svelte is built on the same Dialog primitive, which is
	 * also why the header renders `Dialog.Title` inside the drawer: `Drawer.
	 * Title` is that component re-exported, not a different one. Everything
	 * visible is ours.
	 *
	 * Position is the one thing in this library keyed to the viewport rather
	 * than to a container query: the content is portalled to `<body>`, so it has
	 * no meaningful container to measure. That geometry lives in `overlay-sheet`
	 * and `overlay-drawer` in app.css, because Select and DatePicker are the
	 * same panel and were about to be the same twelve lines.
	 */
	type Props = {
		open?: boolean;
		title: string;
		description?: string;
		trigger?: Snippet;
		children: Snippet;
		class?: ClassValue;
	};

	let {
		open = $bindable(false),
		title,
		description,
		trigger,
		children,
		class: klass
	}: Props = $props();

	// While open, the hardware back button owns the first press — see
	// `ui/overlays.ts`. Registered from the effect so the cleanup runs on close
	// and on unmount alike.
	$effect(() => {
		if (!open) {
			return;
		}
		return registerOverlay(() => (open = false));
	});
</script>

{#snippet header()}
	<div class="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
		<div class="min-w-0">
			<Dialog.Title class="title-panel">{title}</Dialog.Title>
			{#if description}
				<Dialog.Description class="text-sm font-bold text-ink-faint">
					{description}
				</Dialog.Description>
			{/if}
		</div>
		<Dialog.Close>
			{#snippet child({ props })}
				<Button {...props} variant="chrome" caps>CLOSE</Button>
			{/snippet}
		</Dialog.Close>
	</div>
{/snippet}

{#snippet body()}
	<div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
		{@render children()}
	</div>
{/snippet}

{#if wideViewport.current}
	<Dialog.Root bind:open>
		{#if trigger}
			<Dialog.Trigger>
				{@render trigger()}
			</Dialog.Trigger>
		{/if}

		<Dialog.Portal>
			<Dialog.Overlay class="overlay-scrim" />

			<Dialog.Content class={['overlay-panel overlay-sheet', klass]}>
				{@render header()}
				{@render body()}
			</Dialog.Content>
		</Dialog.Portal>
	</Dialog.Root>
{:else}
	<Drawer.Root bind:open>
		{#if trigger}
			<Drawer.Trigger>
				{@render trigger()}
			</Drawer.Trigger>
		{/if}

		<Drawer.Portal>
			<Drawer.Overlay class="overlay-scrim-drawer" />

			<Drawer.Content class={['overlay-panel overlay-drawer', klass]}>
				<Drawer.Handle class="mt-3" />
				{@render header()}
				{@render body()}
			</Drawer.Content>
		</Drawer.Portal>
	</Drawer.Root>
{/if}
