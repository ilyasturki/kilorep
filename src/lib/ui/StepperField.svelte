<script lang="ts" module>
	// One string, two controls. The whole point of the fork below is that the
	// number looks identical whether it is typed into or tapped through, and two
	// copies of the class list is the one way for that to stop being true.
	const numeral =
		'w-full bg-transparent p-0 text-center text-2xl leading-none font-extrabold ' +
		'tracking-numeral focus-ring-inset';
</script>

<script lang="ts">
	import type { ClassValue } from 'svelte/elements';
	import { parseEntry, settle } from '$lib/domain/workout';

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
	 * Stepping from 40 to 100 is twenty-four taps on the arms, so an arm held
	 * down repeats and the arms stay the accelerator for the common case rather
	 * than becoming the only way in. Typing is
	 * either the field's own input or, where the caller hosts a numpad, whatever
	 * `ontype` opens — see that prop.
	 *
	 * `value` is the caller's. The field renders it, proposes the next one, and
	 * owns nothing: a nudge is `onchange`, and what comes back down is the
	 * answer. `bind:value` is the shorthand for that round trip when the caller
	 * has nothing more interesting to do with it.
	 */
	type Props = {
		/** Null is a field with nothing in it — no history to recall, nothing typed yet. */
		value: number | null;
		/**
		 * What the field opened at, and the only thing the touched dot is measured
		 * against.
		 *
		 * The dot is not decoration. PRODUCT.md: the check "commits exactly what's
		 * on screen — the hint/target if untouched, your edits if touched", and the
		 * hint is never silently written. The dot is the only thing on screen that
		 * separates a recalled hint from an affirmative claim, so it has to answer
		 * to the recalled value rather than to the live one — otherwise a caller
		 * that feeds its own edits back in could never show it at all.
		 */
		recalled?: number | null;
		label: string;
		step?: number;
		min?: number;
		onchange?: (value: number) => void;
		/**
		 * Host the typing gesture instead of the field's own input.
		 *
		 * On touch, focusing an input raises the system keyboard, which is the one
		 * thing PRODUCT.md and STACK.md deliberately design out of the logging loop
		 * in favour of the custom pad. The pad has to belong to the caller and not
		 * to this field, because its field-switch key spans two of them; passing
		 * `ontype` is how the caller says so. Absent, the field's input stands.
		 */
		ontype?: () => void;
		class?: ClassValue;
	};

	let {
		value = $bindable(null),
		recalled = null,
		label,
		step = 2.5,
		min = 0,
		onchange,
		ontype,
		class: klass
	}: Props = $props();

	const touched = $derived(value !== recalled);

	// `–` for an empty field, the same glyph `SetRow` shows for a set with no
	// numbers in it yet. Zero is a real weight, so it is never spelled this way.
	const display = $derived(value === null ? '–' : String(settle(value, min)));

	// An empty field steps from `min`, so the first + on a blank weight lands on
	// one step rather than on nothing.
	//
	// Reports whether it moved. At `min` a step down changes nothing, and a
	// silent no-op is the honest answer — the same rule `commit` already keeps,
	// and it is what stops a hold from firing twenty identical `onchange` a
	// second into the floor.
	function nudge(direction: number) {
		const next = settle((value ?? min) + direction * step, min);
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
		// An empty field opens empty, not on the `–` that stands in for it.
		draft = value === null ? '' : display;
		editing = true;
		selectPending = true;
		event.currentTarget.select();
	}

	// Blur commits, so tapping ± while typing steps from the typed number and
	// not from the one it replaced. Anything unparseable is not an affirmative
	// claim, so the field keeps what it had rather than guessing — `parseEntry`
	// owns that rule for the pad as well.
	function commit() {
		const parsed = parseEntry(draft);
		editing = false;
		if (parsed === null) {
			return;
		}
		const next = settle(parsed, min);
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
		{#if ontype}
			<button type="button" onclick={ontype} aria-label="{label}, tap to type" class={numeral}>
				{display}
			</button>
		{:else}
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
				class={numeral}
			/>
		{/if}
		<div class="label-caps">{label}</div>
	</div>

	{@render arm(1, 'increase', 'rounded-r-2xl')}
</div>
