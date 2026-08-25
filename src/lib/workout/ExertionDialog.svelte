<script lang="ts">
	import { Dialog } from 'bits-ui';

	import {
		EXERTION_STEP,
		scaleName,
		shownExertion,
		shownMax,
		shownMin,
		storedExertion
	} from '$lib/domain/exertion';
	import type { ExertionScale } from '$lib/domain/exertion';
	import Button from '$lib/ui/Button.svelte';
	import { registerOverlay } from '$lib/ui/overlays';
	import StepperField from '$lib/ui/StepperField.svelte';

	type Props = {
		open?: boolean;
		scale: ExertionScale;
		/** The set's stored RPE, whatever the display scale. */
		value: number | null;
		onapply: (rpe: number | null) => void;
	};

	let { open = $bindable(false), scale, value, onapply }: Props = $props();

	$effect(() => (open ? registerOverlay(() => (open = false)) : undefined));

	// The field edits in the shown scale and only the apply translates back, so RIR reads as
	// RIR the whole way through.
	let shown = $state<number | null>(null);

	$effect(() => {
		if (open) {
			shown = value === null ? null : shownExertion(value, scale);
		}
	});

	function apply() {
		open = false;
		onapply(shown === null ? null : storedExertion(shown, scale));
	}

	function clear() {
		open = false;
		onapply(null);
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="overlay-scrim" />

		<Dialog.Content class="overlay-panel overlay-centred gap-5 p-5">
			<div class="flex flex-col gap-1.5">
				<Dialog.Title class="title-panel">{scaleName(scale)}</Dialog.Title>
				<Dialog.Description class="text-md font-bold text-ink-faint">
					Any half step from {shownMin(scale)} to {shownMax(scale)}, not just the chips.
				</Dialog.Description>
			</div>

			<StepperField
				bind:value={shown}
				label={scaleName(scale)}
				step={EXERTION_STEP}
				min={shownMin(scale)}
				max={shownMax(scale)}
				seed={shownExertion(8, scale)}
			/>

			<div class="flex gap-2">
				{#if value !== null}
					<Button variant="secondary" onclick={clear}>Clear</Button>
				{/if}

				<Dialog.Close>
					{#snippet child({ props })}
						<Button {...props} variant="secondary" class="flex-1">Cancel</Button>
					{/snippet}
				</Dialog.Close>

				<Button variant="commit" class="flex-1" onclick={apply}>Save</Button>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
