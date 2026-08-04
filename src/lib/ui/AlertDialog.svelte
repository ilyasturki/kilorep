<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import { AlertDialog } from 'bits-ui';
	import Button from '$lib/ui/Button.svelte';
	import { registerOverlay } from '$lib/ui/overlays';

	/**
	 * The confirm before something irreversible: deleting a template, a custom
	 * exercise, a workout in history, disconnecting a server.
	 *
	 * Barely for the gym floor. PRODUCT.md is explicit that the loop does not
	 * stop to ask — a template starts with no confirm, Finish ends with none,
	 * and discarding an empty workout is one action. The single exception is
	 * removing a set that has already been logged: that is the only data the
	 * workout screen holds, and nothing in the app can put it back.
	 *
	 * Centred at every width, and that is the point. It is the one overlay in
	 * the app that does not rise from the bottom, because the set-options sheet
	 * teaches a reflex — sheets go away when you tap outside — and "delete this
	 * template" must not inherit it. Bits UI's alert-dialog refuses the outside
	 * tap already; this makes the refusal visible before the tap happens.
	 *
	 * The API is fixed rather than a children snippet on purpose: a confirm with
	 * arbitrary content is a dialog, and a dialog is Sheet.
	 */
	type Props = {
		open?: boolean;
		title: string;
		description?: string;
		confirmLabel: string;
		cancelLabel?: string;
		onconfirm: () => void;
		trigger?: Snippet;
		class?: ClassValue;
	};

	let {
		open = $bindable(false),
		title,
		description,
		confirmLabel,
		cancelLabel = 'Cancel',
		onconfirm,
		trigger,
		class: klass
	}: Props = $props();

	let cancel = $state<HTMLElement | null>(null);

	// Hardware back cancels the confirm — the safe direction, same as Escape.
	// See `ui/overlays.ts`.
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
	{#if trigger}
		<AlertDialog.Trigger>{@render trigger()}</AlertDialog.Trigger>
	{/if}

	<AlertDialog.Portal>
		<AlertDialog.Overlay class="overlay-scrim" />

		<AlertDialog.Content
			onOpenAutoFocus={focusCancel}
			class={['overlay-panel overlay-centred gap-5 p-5', klass]}
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
						<Button {...props} variant="secondary" class="flex-1">{cancelLabel}</Button>
					{/snippet}
				</AlertDialog.Cancel>

				<!-- Not `AlertDialog.Action`: that part exists to close the dialog, which
				     `confirm` already does, and wrapping it would mean composing our
				     handler with one arriving through an untyped snippet prop. -->
				<Button variant="destructive" class="flex-1" onclick={confirm}>
					{confirmLabel}
				</Button>
			</div>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>
