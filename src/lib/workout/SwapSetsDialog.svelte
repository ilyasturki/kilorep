<script lang="ts">
	import { AlertDialog } from 'bits-ui';

	import type { SwapMode } from '$lib/domain/workout';
	import Button from '$lib/ui/Button.svelte';
	import { registerOverlay } from '$lib/ui/overlays';

	type Props = {
		open?: boolean;
		from: string;
		to: string;
		logged: number;
		onchoose: (mode: SwapMode) => void;
	};

	let { open = $bindable(false), from, to, logged, onchoose }: Props = $props();

	let cancel = $state<HTMLElement | null>(null);

	$effect(() => (open ? registerOverlay(() => (open = false)) : undefined));

	function choose(mode: SwapMode) {
		open = false;
		onchoose(mode);
	}
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Portal>
		<AlertDialog.Overlay class="overlay-scrim" />

		<AlertDialog.Content
			onOpenAutoFocus={(event) => {
				event.preventDefault();
				cancel?.focus();
			}}
			class="overlay-panel overlay-centred gap-5 p-5"
		>
			<div class="flex flex-col gap-1.5">
				<AlertDialog.Title class="title-panel">
					{logged === 1 ? '1 set' : `${logged} sets`} logged on {from}
				</AlertDialog.Title>
				<AlertDialog.Description class="text-md font-bold text-ink-faint">
					{logged === 1 ? 'Moved, it keeps its numbers' : 'Moved, they keep their numbers'}. Kept,
					only the sets still to do go to {to}.
				</AlertDialog.Description>
			</div>

			<div class="flex flex-col gap-2">
				<Button variant="primary" class="w-full" onclick={() => choose('move')}>
					Move {logged === 1 ? 'it' : 'them'} to {to}
				</Button>
				<Button variant="secondary" class="w-full" onclick={() => choose('keep')}>
					Keep {logged === 1 ? 'it' : 'them'} on {from}
				</Button>
				<Button variant="destructive" class="w-full" onclick={() => choose('delete')}>
					Delete {logged === 1 ? 'it' : 'them'}
				</Button>

				<AlertDialog.Cancel bind:ref={cancel}>
					{#snippet child({ props })}
						<Button {...props} variant="secondary" class="w-full">Cancel</Button>
					{/snippet}
				</AlertDialog.Cancel>
			</div>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>
