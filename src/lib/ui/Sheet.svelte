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
		/**
		 * A bar pinned below the scroll box — the picker's `Add 3 exercises`, and
		 * nothing else so far.
		 *
		 * Outside `body` rather than the last thing inside it, which is the whole
		 * point: a commit that scrolls away with the list is a commit the user has
		 * to go and find after checking the eighth row. The panel is already a flex
		 * column with the body taking the slack, so this costs no geometry of its
		 * own.
		 */
		footer?: Snippet;
		class?: ClassValue;
	};

	let {
		open = $bindable(false),
		title,
		description,
		trigger,
		children,
		footer,
		class: klass
	}: Props = $props();

	// While open, the hardware back button owns the first press — see
	// `ui/overlays.ts`. Registered from the effect so the cleanup runs on close
	// and on unmount alike.
	$effect(() => (open ? registerOverlay(() => (open = false)) : undefined));
</script>

<!-- CLOSE belongs to the dialog branch alone: the drawer wears the handle and
     answers the flick it teaches, and a button restating what the gesture,
     the scrim and the hardware back all already do was chrome on a surface
     that has none to spare. -->
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

	<!-- The hairline is the scroll box's edge, drawn only when something sits
	     below it: it says the list continues under the bar rather than ending
	     there. `shrink-0` because the body above it is what gives, always — a
	     panel at its 85dvh ceiling must lose list, never the commit. -->
	{#if footer}
		<div class="shrink-0 border-t border-line-soft px-4 pt-3">
			{@render footer()}
		</div>
	{/if}
{/snippet}

{#if wideViewport.current}
	<Dialog.Root bind:open>
		{#if trigger}
			<Dialog.Trigger>{@render trigger()}</Dialog.Trigger>
		{/if}

		<Dialog.Portal>
			<Dialog.Overlay class="overlay-scrim" />

			<Dialog.Content class={['overlay-panel overlay-sheet', klass]}>
				{@render header(true)}
				{@render body()}
			</Dialog.Content>
		</Dialog.Portal>
	</Dialog.Root>
{:else}
	<Drawer.Root bind:open>
		{#if trigger}
			<Drawer.Trigger>{@render trigger()}</Drawer.Trigger>
		{/if}

		<Drawer.Portal>
			<Drawer.Overlay class="overlay-scrim-drawer" />

			<Drawer.Content class={['overlay-panel overlay-drawer', klass]}>
				<Drawer.Handle class="mt-3" />
				{@render header(false)}
				{@render body()}
			</Drawer.Content>
		</Drawer.Portal>
	</Drawer.Root>
{/if}
