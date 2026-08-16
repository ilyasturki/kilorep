<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import { Popover, Tooltip } from 'bits-ui';

	import { bubble } from '$lib/ui/Tooltip.svelte';
	import { coarsePointer } from '$lib/ui/pointer';
	import { press } from '$lib/ui/press';

	type Props = {
		label: string;
		onclick: () => void;
		class?: ClassValue;
		children: Snippet;
	};

	let { label, onclick, class: klass, children }: Props = $props();

	let open = $state(false);
	let anchor = $state<HTMLElement | null>(null);

	function reveal(element: HTMLElement): void {
		anchor = element;
		open = true;
	}
</script>

{#if coarsePointer}
	<button type="button" aria-label={label} {onclick} class={klass} {@attach press(() => reveal)}>
		{@render children()}
	</button>

	<Popover.Root bind:open>
		<Popover.Portal>
			<Popover.Content customAnchor={anchor} sideOffset={6} class={bubble}>
				{label}
			</Popover.Content>
		</Popover.Portal>
	</Popover.Root>
{:else}
	<Tooltip.Root>
		<Tooltip.Trigger aria-label={label} {onclick} class={klass}>
			{@render children()}
		</Tooltip.Trigger>
		<Tooltip.Portal>
			<Tooltip.Content sideOffset={6} class={bubble}>{label}</Tooltip.Content>
		</Tooltip.Portal>
	</Tooltip.Root>
{/if}
