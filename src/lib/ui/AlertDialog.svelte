<script lang="ts">
	import { AlertDialog } from 'bits-ui';
	import Button from '$lib/ui/Button.svelte';
	import { registerOverlay } from '$lib/ui/overlays';

	type Props = {
		open?: boolean;
		title: string;
		description?: string;
		confirmLabel: string;
		/**
		 * Set when this dialog is asked from another overlay — the Weight log's
		 * Delete, raised from the edit sheet. Without it the scrim lands under the
		 * panel that raised it and the sheet stays lit behind the question.
		 */
		stacked?: boolean;
		onconfirm: () => void;
	};

	let {
		open = $bindable(false),
		title,
		description,
		confirmLabel,
		stacked = false,
		onconfirm
	}: Props = $props();

	let cancel = $state<HTMLElement | null>(null);

	$effect(() => (open ? registerOverlay(() => (open = false)) : undefined));

	// Bits UI focuses the panel itself, which is correct for a dialog you are
	// about to read and wrong for one you are about to dismiss. The safe choice
	// is the one under the thumb: a stray Enter or Space cancels.
	//
	// The button arrives through `bind:ref` on the Cancel part rather than a
	// marker attribute and a `querySelector`: the part already exposes the node,
	// and a private `data-` handle nothing else reads breaks silently the day
	// someone removes it.
	function focusCancel(event: Event) {
		event.preventDefault();
		cancel?.focus();
	}

	function confirm() {
		open = false;
		onconfirm();
	}
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Portal>
		<AlertDialog.Overlay class={['overlay-scrim', stacked && 'overlay-stacked']} />

		<AlertDialog.Content
			onOpenAutoFocus={focusCancel}
			class={['overlay-panel overlay-centred gap-5 p-5', stacked && 'overlay-stacked']}
		>
			<div class="flex flex-col gap-1.5">
				<AlertDialog.Title class="title-panel">{title}</AlertDialog.Title>
				{#if description}
					<AlertDialog.Description class="text-md font-bold text-ink-faint">
						{description}
					</AlertDialog.Description>
				{/if}
			</div>

			<div class="flex gap-2">
				<AlertDialog.Cancel bind:ref={cancel}>
					{#snippet child({ props })}
						<Button {...props} variant="secondary" class="flex-1">Cancel</Button>
					{/snippet}
				</AlertDialog.Cancel>

				<Button variant="destructive" class="flex-1" onclick={confirm}>
					{confirmLabel}
				</Button>
			</div>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>
