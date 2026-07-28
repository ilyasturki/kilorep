<script lang="ts" module>
	const key = 'grid min-h-row place-items-center rounded-xl font-bold focus-ring-inset';
	const digit = `${key} bg-sunken text-2xl hover:bg-surface-2 active:bg-surface-2`;
	const utility = `${key} bg-surface-2 text-ink-muted hover:bg-sunken active:bg-sunken`;
	const confirmKey = `${key} bg-accent text-on-accent hover:brightness-[0.97] active:brightness-[0.94]`;

	const utilityWide = `${utility} text-sm tracking-wide`;
	const digitWide = `${digit} col-span-2`;
	const confirmTall = `${confirmKey} row-span-2`;

	const rows = [
		['7', '8', '9'],
		['4', '5', '6'],
		['1', '2', '3']
	];
</script>

<script lang="ts">
	import type { ClassValue } from 'svelte/elements';
	import Button from '$lib/ui/Button.svelte';
	import Backspace from '$lib/ui/icons/Backspace.svelte';
	import Check from '$lib/ui/icons/Check.svelte';
	import { coarsePointer } from '$lib/ui/pointer';

	/**
	 * The pad replaces the dock rather than covering it, so the rest bar stays
	 * reachable while a number is being typed.
	 *
	 * On a device with a keyboard the grid is the wrong control — it is slower
	 * than the keys already under the user's hands — so `mode` defaults to a
	 * real text field there and the grid is not rendered at all. The default
	 * comes from `(pointer: coarse)`, read once per app in `$lib/ui/pointer`;
	 * pass `mode` explicitly to pin it, which is how the styleguide shows both.
	 */
	type Props = {
		label: string;
		/** Shown greyed until the first key: the value the pad would commit as-is. */
		placeholder: string;
		mode?: 'keys' | 'input';
		maxLength?: number;
		fieldSwitchLabel?: string;
		onconfirm?: (value: string) => void;
		onfieldswitch?: () => void;
		onclose?: () => void;
		class?: ClassValue;
	};

	let {
		label,
		placeholder,
		mode,
		maxLength = 6,
		fieldSwitchLabel = 'REPS',
		onconfirm,
		onfieldswitch,
		onclose,
		class: klass
	}: Props = $props();

	const defaultMode = coarsePointer ? 'keys' : 'input';
	const resolved = $derived(mode ?? defaultMode);

	let buffer = $state('');
	const display = $derived(buffer === '' ? placeholder : buffer);

	function press(k: string) {
		if (k === 'del') {
			buffer = buffer.slice(0, -1);
			return;
		}
		if (k === '.' && buffer.includes('.')) {
			return;
		}
		if (buffer.length >= maxLength) {
			return;
		}
		buffer += k;
	}

	function confirm() {
		onconfirm?.(display);
		buffer = '';
	}

	// The grid is for thumbs, but a keyboard is never wrong: anyone reviewing
	// this on a desktop, or using a Bluetooth keyboard, can just type.
	function onkeydown(event: KeyboardEvent) {
		if (event.key >= '0' && event.key <= '9') {
			press(event.key);
		} else if (event.key === '.' || event.key === ',') {
			press('.');
		} else if (event.key === 'Backspace') {
			press('del');
		} else if (event.key === 'Enter') {
			confirm();
		} else if (event.key === 'Escape') {
			onclose?.();
		} else {
			return;
		}
		event.preventDefault();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	{onkeydown}
	role="group"
	aria-label={label}
	class={['rounded-xl border border-line bg-surface p-3', klass]}
>
	<div class="flex items-end justify-between gap-3 px-1 pb-3">
		<div class="min-w-0">
			<div class="label-caps">{label}</div>
			{#if resolved === 'keys'}
				<div
					class={['text-4xl font-extrabold tracking-numeral', buffer === '' && 'text-ink-faint']}
				>
					{display}
				</div>
			{:else}
				<input
					bind:value={buffer}
					{placeholder}
					inputmode="decimal"
					autocomplete="off"
					aria-label={label}
					class="w-full max-w-56 bg-transparent text-4xl font-extrabold tracking-numeral
						outline-none placeholder:text-ink-faint"
				/>
			{/if}
		</div>
		<Button variant="chrome" caps onclick={onclose}>CLOSE</Button>
	</div>

	{#if resolved === 'keys'}
		<div class="grid grid-cols-4 gap-2">
			{#each rows[0] as k (k)}
				<button type="button" class={digit} onclick={() => press(k)}>{k}</button>
			{/each}
			<button type="button" class={utility} aria-label="delete" onclick={() => press('del')}>
				<Backspace size={24} />
			</button>

			{#each rows[1] as k (k)}
				<button type="button" class={digit} onclick={() => press(k)}>{k}</button>
			{/each}
			<button type="button" class={utilityWide} onclick={onfieldswitch}>
				{fieldSwitchLabel}
			</button>

			{#each rows[2] as k (k)}
				<button type="button" class={digit} onclick={() => press(k)}>{k}</button>
			{/each}
			<button type="button" aria-label="confirm" class={confirmTall} onclick={confirm}>
				<Check size={30} />
			</button>

			<button type="button" class={digitWide} onclick={() => press('0')}>0</button>
			<button type="button" class={digit} onclick={() => press('.')}>.</button>
		</div>
	{:else}
		<button type="button" class="{confirmKey} w-full gap-3" onclick={confirm}>
			<Check size={26} />
			<span class="text-lg font-extrabold">Log</span>
		</button>
		<p class="px-1 pt-2 text-sm font-bold text-ink-faint">
			Type the value · Enter logs · Esc closes
		</p>
	{/if}
</div>
