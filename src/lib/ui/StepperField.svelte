<script lang="ts">
	import type { ClassValue } from 'svelte/elements';

	/**
	 * A weight or rep field with fat ± on either side of the number.
	 *
	 * The dot above the value is not decoration. The check "commits
	 * exactly what's on screen — the hint/target if untouched, your edits if
	 * touched", and the hint is never silently written. The dot is the only
	 * thing on screen that distinguishes a recalled hint from an affirmative
	 * claim, so it appears the moment the value leaves its prefill and clears
	 * again if you step back onto it.
	 *
	 * The number itself is a real input, on every pointer type rather than only
	 * where `(pointer: fine)` holds. The arms are the accelerator for the common
	 * case, not the only way in: an arm held down repeats, and typing is there
	 * for the value that is nowhere near the hint. Typing is a distinct gesture
	 * from tapping ± — nothing is swapped out underneath the user — so unlike
	 * the numpad's key grid this needs no pointer read to decide what to render.
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

	// Reports whether it moved. At `min` a step down changes nothing, and a
	// silent no-op is the honest answer — the same rule `commit` already keeps,
	// and it is what stops a hold from firing twenty identical `onchange` a
	// second into the floor.
	function nudge(direction: number) {
		const next = settle(value + direction * step);
		if (next === value) {
			return false;
		}
		value = next;
		onchange?.(next);
		return true;
	}

	// Hold to repeat. Stepping from 40 to 100 is twenty-four taps, which is the
	// cost this field was apologising for; held down it is one gesture of about
	// two and a half seconds. The first step lands on `pointerdown`, then a pause
	// long enough to tell a tap from a hold, then an interval that ramps down to
	// a floor — slow at the start so the value one step away is still reachable,
	// fast by the end so the one twenty steps away is too.
	//
	// A `setTimeout` chain rather than `setInterval`: the delay changes on every
	// tick. The ramp is driven by the tick count and not by a clock reading, so a
	// busy frame shifts the schedule rather than skipping through it.
	const HOLD_DELAY = 500;
	const REPEAT_FROM = 180;
	const REPEAT_FLOOR = 50;
	const REPEAT_RAMP = 0.92;

	// Neither is `$state`: both are written and read inside handlers, and nothing
	// renders from either.
	let timer: ReturnType<typeof setTimeout> | undefined;
	let claimed = false;

	function holdStart(direction: number) {
		clearTimeout(timer);
		// The click this pointer sequence ends with would step a second time.
		claimed = true;
		nudge(direction);

		let delay = REPEAT_FROM;
		const tick = () => {
			if (!nudge(direction)) {
				return;
			}
			delay = Math.max(REPEAT_FLOOR, delay * REPEAT_RAMP);
			timer = setTimeout(tick, delay);
		};
		timer = setTimeout(tick, HOLD_DELAY);
	}

	function holdEnd() {
		clearTimeout(timer);
	}

	// A set committed mid-hold takes the field down with it, and the chain would
	// otherwise keep calling `onchange` from a component nobody is rendering.
	// The body tracks nothing, so this is a teardown on destroy and nothing else.
	$effect(() => () => clearTimeout(timer));

	// A pointer that leaves the arm — or a scroll that swallows it — produces no
	// click to swallow in turn, so the claim has to leave with it. Left standing,
	// it would eat the next keyboard Enter instead.
	function holdCancel() {
		clearTimeout(timer);
		claimed = false;
	}

	// Keyboard activation arrives here with no `pointerdown` before it, so it is
	// the one path that still steps on click.
	function activate(direction: number) {
		if (claimed) {
			claimed = false;
			return;
		}
		nudge(direction);
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
		onclick={() => activate(direction)}
		onpointerdown={() => holdStart(direction)}
		onpointerup={holdEnd}
		onpointerleave={holdCancel}
		onpointercancel={holdCancel}
		class={[
			'grid w-11 shrink-0 place-items-center text-2xl font-semibold focus-ring-inset',
			// `manipulation`, not `none`: a scroll that starts on the arm still
			// scrolls the page and arrives back here as a `pointercancel`. Taking
			// the gesture outright would make a fat target in the logging loop a
			// dead zone for the one thing every screen does.
			'touch-manipulation select-none',
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
