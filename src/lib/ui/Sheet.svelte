<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import { Dialog } from 'bits-ui';
	import Button from '$lib/ui/Button.svelte';

	/**
	 * Session overview, set options, anything that slides up over the loop.
	 *
	 * Focus trap, scroll lock and dismiss-on-outside come from Bits UI — the
	 * parts that are miserable to hand-roll and easy to get subtly wrong on a
	 * touch device. Everything visible is ours.
	 *
	 * Position is the one thing in this library keyed to the viewport rather
	 * than to a container query: the content is portalled to `<body>`, so it has
	 * no meaningful container to measure. That geometry now lives in
	 * `overlay-sheet` in app.css, because Select and DatePicker are the same
	 * panel and were about to be the same twelve lines.
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
</script>

<Dialog.Root bind:open>
	{#if trigger}
		<Dialog.Trigger>
			{@render trigger()}
		</Dialog.Trigger>
	{/if}

	<Dialog.Portal>
		<Dialog.Overlay class="overlay-scrim" />

		<Dialog.Content class={['overlay-panel overlay-sheet', klass]}>
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

			<div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
				{@render children()}
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
