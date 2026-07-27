<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog } from 'bits-ui';
	import Button from '$lib/ui/Button.svelte';
	import { cn } from '$lib/ui/cn';

	/**
	 * Session overview, set options, anything that slides up over the loop.
	 *
	 * Focus trap, scroll lock and dismiss-on-outside come from Bits UI — the
	 * parts that are miserable to hand-roll and easy to get subtly wrong on a
	 * touch device. Everything visible is ours.
	 *
	 * Position is the one thing in this library keyed to the viewport rather
	 * than to a container query: the content is portalled to `<body>`, so it has
	 * no meaningful container to measure. Below `sm` it is a bottom sheet within
	 * thumb reach; at `sm` and up it is a centred dialog, because a sheet welded
	 * to the bottom edge of a 1400px window is a phone habit, not a layout.
	 */
	type Props = {
		open?: boolean;
		title: string;
		description?: string;
		trigger?: Snippet;
		children: Snippet;
		class?: string;
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
		<Dialog.Overlay
			class="fixed inset-0 z-40 bg-scrim transition-opacity duration-200
				data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
		/>

		<Dialog.Content
			class={cn(
				'fixed z-50 flex flex-col bg-surface text-ink',
				// Bottom sheet: full width, rounded top corners, clear of the gesture bar.
				'inset-x-0 bottom-0 rounded-t-sheet border-t border-line',
				'pb-[max(1.25rem,var(--spacing-safe-b))]',
				// Centred dialog from sm up.
				'sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-lg',
				'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-sheet sm:border sm:pb-5',
				// 180ms on the design's own sheet curve. The sheet rises; the
				// dialog only fades, because a centred box sliding is noise.
				'transition-[translate,opacity] duration-[180ms] ease-[cubic-bezier(.2,.8,.3,1)]',
				'data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full',
				'sm:data-[ending-style]:translate-y-[-50%] sm:data-[starting-style]:translate-y-[-50%]',
				'sm:data-[ending-style]:opacity-0 sm:data-[starting-style]:opacity-0',
				klass
			)}
		>
			<div class="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
				<div class="min-w-0">
					<Dialog.Title class="text-lg font-extrabold tracking-tight">{title}</Dialog.Title>
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
