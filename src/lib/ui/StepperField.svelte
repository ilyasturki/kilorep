<script lang="ts">
	import type { ClassValue } from 'svelte/elements';

	/**
	 * A weight or rep field with fat ± on either side of the number.
	 *
	 * The dot above the value is not decoration. PRODUCT.md: the check "commits
	 * exactly what's on screen — the hint/target if untouched, your edits if
	 * touched", and the hint is never silently written. The dot is the only
	 * thing on screen that distinguishes a recalled hint from an affirmative
	 * claim, so it appears the moment the value leaves its prefill and clears
	 * again if you step back onto it.
	 *
	 * The number itself is a real input, on every pointer type rather than only
	 * where `(pointer: fine)` holds. Stepping from 40 to 100 is twenty-four taps
	 * on the arms, and the arms are the accelerator for the common case, not the
	 * only way in. Typing is a distinct gesture from tapping ± — nothing is
	 * swapped out underneath the user — so unlike the numpad's key grid this
	 * needs no pointer read to decide what to render.
	 */
	type Props = {
		prefill: number;
		label: string;
		step?: number;
		min?: number;
		onchange?: (value: number) => void;
		class?: ClassValue;
	};

	let { prefill, label, step = 2.5, min = 0, onchange, class: klass }: Props = $props();

	// A derived value can be reassigned, and the override is dropped the moment
	// its dependency changes — which is exactly the rule this field needs: a nudge
	// overrides the hint, and a new prefill (a new set) takes the field back with
	// the touched dot. Written as an effect it needed a shadow copy of `prefill`
	// to stop itself looping; derived, the reset is the framework's job.
	let value = $derived(prefill);

	const touched = $derived(value !== prefill);
	const display = $derived(String(Math.round(value * 100) / 100));

	const settle = (n: number) => Math.max(min, Math.round(n * 100) / 100);

	function nudge(direction: number) {
		value = settle(value + direction * step);
		onchange?.(value);
	}

	// Typing is held in `draft` and only lands in `value` on commit. Writing
	// every keystroke through would fire `onchange` per digit and make the
	// touched dot blink on the way from 8 to 82.5 — and a half-typed "8." is
	// not a number the rest of the app should ever see.
	let draft = $state('');
	let editing = $state(false);

	// A caret placed in "82.5" means editing the wrong two digits; the gesture
	// is always "this weight, not that one". `select()` in `onfocus` is undone
	// by the mouseup that follows a click, so that one mouseup is swallowed.
	// Not `$state`: written and read inside handlers, nothing renders from it.
	let selectPending = false;

	function start(event: FocusEvent & { currentTarget: HTMLInputElement }) {
		draft = display;
		editing = true;
		selectPending = true;
		event.currentTarget.select();
	}

	// Blur commits, so tapping ± while typing steps from the typed number and
	// not from the one it replaced. Anything unparseable — empty, a lone dot,
	// a pasted word — is not an affirmative claim, so the field keeps what it
	// had rather than guessing.
	function commit() {
		const parsed = Number(draft.replace(',', '.'));
		editing = false;
		if (draft.trim() === '' || !Number.isFinite(parsed)) {
			return;
		}
		const next = settle(parsed);
		if (next !== value) {
			value = next;
			onchange?.(next);
		}
	}

	function onkeydown(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (event.key === 'Enter') {
			event.currentTarget.blur();
		} else if (event.key === 'Escape') {
			draft = display;
			editing = false;
			event.currentTarget.blur();
		}
	}
</script>

{#snippet arm(direction: number, verb: string, corner: string)}
	<button
		type="button"
		aria-label="{verb} {label}"
		onclick={() => nudge(direction)}
		class={[
			'grid w-11 shrink-0 place-items-center text-2xl font-semibold focus-ring-inset',
			'text-ink-muted hover:bg-surface-2 active:bg-surface-2 active:text-ink',
			corner
		]}
	>
		{direction < 0 ? '−' : '+'}
	</button>
{/snippet}

<div
	class={['relative flex min-h-19 items-stretch rounded-2xl bg-sunken', klass]}
	role="group"
	aria-label={label}
>
	{#if touched}
		<div class="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
			<div class="size-1.5 rounded-full bg-accent-text"></div>
		</div>
	{/if}

	{@render arm(-1, 'decrease', 'rounded-l-2xl')}

	<div class="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5">
		<input
			value={editing ? draft : display}
			oninput={(event) => (draft = event.currentTarget.value)}
			onfocus={start}
			onblur={commit}
			onmouseup={(event) => {
				if (selectPending) {
					selectPending = false;
					event.preventDefault();
				}
			}}
			{onkeydown}
			inputmode="decimal"
			autocomplete="off"
			aria-label={label}
			class="w-full bg-transparent p-0 text-center text-2xl leading-none font-extrabold
				tracking-numeral focus-ring-inset"
		/>
		<div class="label-caps">{label}</div>
	</div>

	{@render arm(1, 'increase', 'rounded-r-2xl')}
</div>
