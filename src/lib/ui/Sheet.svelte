<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog } from 'bits-ui';
	import { Drawer } from 'vaul-svelte';
	import Button from '$lib/ui/Button.svelte';
	import type { Pane } from '$lib/ui/keyboard';
	import { keyboardHeight, keyboardUp, visiblePane, watchVisiblePane } from '$lib/ui/keyboard';
	import { registerOverlay } from '$lib/ui/overlays';
	import { wideViewport } from '$lib/ui/viewport';

	type Props = {
		open?: boolean;
		title: string;
		description?: string;
		/**
		 * One control on the title line, for an act the sheet is *about* rather
		 * than an act it commits — the weigh-in editor's Delete. It sits beside
		 * CLOSE and never replaces it: a sheet with no way out is a trap, and a
		 * destructive icon standing where the exit was is worse than a trap.
		 */
		action?: Snippet;
		children: Snippet;
		footer?: Snippet;
	};

	let { open = $bindable(false), title, description, action, children, footer }: Props = $props();

	$effect(() => (open ? registerOverlay(() => (open = false)) : undefined));

	let panel = $state<HTMLElement | null>(null);

	/**
	 * Where the sheet stands while the OS keyboard is up. Two numbers, written as
	 * custom properties the drawer's CSS reads: the height of the keys, and the
	 * strip of screen left above them.
	 *
	 * This is vaul's own `repositionInputs` job, turned off at the root and done
	 * here instead, because the library's version is the bug. It writes an inline
	 * pixel `height` onto a panel that has none of its own — the sheet is
	 * content-sized under a `max-height` — measuring against an
	 * `initialDrawerHeight` it captures lazily and never clears. Once the keys go
	 * back down that stale number is what the sheet is restored to, which is how a
	 * search in the exercise picker left the sheet at half the size it opened at.
	 *
	 * Turning the flag off costs nothing else on this platform: the only other
	 * thing it gates is vaul's `usePreventScroll`, whose body is iOS-only, and the
	 * scroll lock that matters comes from Bits UI's dialog underneath.
	 *
	 * The `transition` it deletes is vaul's, not ours. A released drag that did
	 * not close writes `transition: transform …` inline as it settles, and a
	 * `transition` shorthand replaces the whole list — the stylesheet's `bottom`
	 * and `max-height` legs included, so the next keyboard would arrive by
	 * teleport. Clearing the inline one hands the rule back. It is safe to do
	 * mid-drag too: vaul re-writes `transition: none` on every pointer move.
	 */
	$effect(() => {
		if (!open || panel === null) {
			return;
		}

		const node = panel;

		const dock = (pane: Pane): void => {
			if (keyboardUp(pane)) {
				node.style.setProperty('--sheet-keys', `${keyboardHeight(pane)}px`);
				node.style.setProperty('--sheet-pane', `${pane.height}px`);
			} else {
				node.style.removeProperty('--sheet-keys');
				node.style.removeProperty('--sheet-pane');
			}

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
