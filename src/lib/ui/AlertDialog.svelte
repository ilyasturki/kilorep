<script lang="ts">
	import { AlertDialog } from 'bits-ui';
	import Button from '$lib/ui/Button.svelte';
	import { registerOverlay } from '$lib/ui/overlays';

	type Props = {
		open?: boolean;
		title: string;
		description?: string;
		confirmLabel: string;
		confirmVariant?: 'destructive' | 'primary';
		stacked?: boolean;
		onconfirm: () => void;
	};

	let {
		open = $bindable(false),
		title,
		description,
		confirmLabel,
		confirmVariant = 'destructive',
		stacked = false,
		onconfirm
	}: Props = $props();

	let cancel = $state<HTMLElement | null>(null);

	$effect(() => (open ? registerOverlay(() => (open = false)) : undefined));

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

				<Button variant={confirmVariant} class="flex-1" onclick={confirm}>
					{confirmLabel}
				</Button>
			</div>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>
