<script lang="ts" module>
	const trigger =
		'focus-ring inline-grid size-6 shrink-0 place-items-center rounded-full align-middle ' +
		'text-ink-faint hover:text-ink-muted';

	/**
	 * Exported for `TipButton`, which is the other half of this idea: this
	 * component hangs an ⓘ off a word, that one turns a button's own glyph into
	 * the trigger. Two triggers, one bubble — a second rounding or a second
	 * shadow would read as a second kind of thing being said.
	 */
	export const bubble =
		'z-50 max-w-64 rounded-xl border border-line bg-surface px-3 py-2 ' +
		'text-sm font-bold text-ink shadow-lg';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import { Popover, Tooltip } from 'bits-ui';
	import Info from '$lib/ui/icons/Info.svelte';
	import { coarsePointer } from '$lib/ui/pointer';

	type Props = {
		text: string;
		children: Snippet;
		class?: ClassValue;
	};

	let { text, children, class: klass }: Props = $props();
</script>

<span class={['inline-flex items-center gap-1', klass]}>
	{@render children()}

	{#if coarsePointer}
		<Popover.Root>
			<Popover.Trigger class={trigger} aria-label="More information">
				<Info size={16} />
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content sideOffset={6} class={bubble}>{text}</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	{:else}
		<Tooltip.Root>
			<Tooltip.Trigger class={trigger} aria-label="More information">
				<Info size={16} />
			</Tooltip.Trigger>
			<Tooltip.Portal>
				<Tooltip.Content sideOffset={6} class={bubble}>{text}</Tooltip.Content>
			</Tooltip.Portal>
		</Tooltip.Root>
	{/if}
</span>
