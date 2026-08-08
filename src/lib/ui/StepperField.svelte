<script lang="ts">
	import type { ClassValue } from 'svelte/elements';
	import { isEntryDraft, parseEntry, settle } from '$lib/domain/workout';
	import { tapLift } from '$lib/ui/haptics';
	import { coarsePointer } from '$lib/ui/pointer';
	import { press } from '$lib/ui/press';
	import Ruler from '$lib/ui/Ruler.svelte';

	type Props = {
		value: number | null;
		recalled?: number | null;
		label: string;
		step?: number;
		min?: number;
		max?: number;
		/** Open the ruler when the number is tapped. Opt-in, and it goes on the
		 * fields a thumb reaches for daily: the two on the active set, the custom
		 * exertion value, and today's body weight. The history editor and the
		 * body-weight page's past-day sheet keep the bare keyboard — a correction
		 * is aimed at a number you already know, and a full-screen panel is a lot
		 * of screen to spend on typing it. */
		ruler?: boolean;
		/** What one detent of the ruler is worth, when that is not what one tap of
		 * an arm is worth. Body weight steps 0.1 on the arms and 0.05 on the strip:
		 * a tap below a bathroom scale's own resolution is a tap that does nothing
		 * you can verify, while a drag is aimed rather than counted and may as well
		 * land anywhere the scale can read. */
		rulerStep?: number;
		/** How many detents between the ruler's emphasised rungs. */
		major?: number;
		onchange?: (value: number | null) => void;
		onpreview?: (value: number | null) => void;
		class?: ClassValue;
	};

	let {
		value = $bindable(null),
		recalled = null,
		label,
		step = 2.5,
		min = 0,
		max = Infinity,
		ruler = false,
		rulerStep,
		major,
		onchange,
		onpreview,
		class: klass
	}: Props = $props();

	/* A `$derived` rather than a destructuring default, which would have to read
	   `step` while `step` is still being bound. */
	const detent = $derived(rulerStep ?? step);

	/* At a fine pointer, focusing the field does exactly what it always did. The
	   ruler is a gesture, and a gesture aimed with a mouse is a worse way to reach
	   a number than the keyboard already sitting under the hand. */
	const scrubbable = $derived(ruler && coarsePointer);

	const touched = $derived(value !== recalled);

	const display = $derived(value === null ? '–' : String(settle(value, min, max)));

	function nudge(direction: number) {
		const next = settle((value ?? min) + direction * step, min, max);
		if (next === value) {
			return false;
		}
		value = next;
		onchange?.(next);
		return true;
	}

	let timer: ReturnType<typeof setTimeout> | undefined;
	let repeating = false;

	function nudgeOnce(event: MouseEvent, direction: number) {
		if (repeating && event.detail !== 0) {
			repeating = false;
			return;
		}

		nudge(direction);
	}

	// Hold to repeat. Stepping from 40 to 100 is twenty-four taps, which is the
	// cost this field was apologising for; held down it is one gesture of about
	// two and a half seconds. A pause long enough to be deliberate, then an
	// interval that ramps down to a floor — slow at the start so the value one
	// step away is still reachable, fast by the end so the one twenty steps away
	// is too.
	//
	// The pause no longer has to be long enough to tell a tap from a hold, since
	// `click` settles that: it is purely how long the field waits before it
	// starts running, which is why it is 350 and not the 500 that a
	// gesture-recognition threshold would need. `SetRow`'s long-press stays at
	// 500 — that one opens a surface, and this one only accelerates.
	//
	// A `setTimeout` chain rather than `setInterval`: the delay changes on every
	// tick. The ramp is driven by the tick count and not by a clock reading, so a
	// busy frame shifts the schedule rather than skipping through it.
	const HOLD_DELAY = 350;
	const REPEAT_FROM = 180;
	const REPEAT_FLOOR = 50;
	const REPEAT_RAMP = 0.92;

	function holdStart(direction: number) {
		clearTimeout(timer);
		repeating = false;

		let delay = REPEAT_FROM;
		const tick = () => {
			// Only as the run starts. The buzz says the field has taken the hold as a
			// hold and is now driving itself — one per gesture, not one per step,
			// which at a 50ms floor would be a rattle rather than a signal.
			if (!repeating) {
				tapLift();
				repeating = true;
			}

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

	$effect(() => () => clearTimeout(timer));

	let draft = $state('');
	let editing = $state(false);

	let selectPending = false;

	let box = $state<HTMLInputElement | null>(null);
	let open = $state(false);

	/* What the ruler's band shows instead of the value, and `null` until the first
	   keystroke. `draft` alone cannot answer this: focusing the field seeds it with
	   the current value and selects it, and a band showing "102.5" behind a
	   blinking caret would be claiming something was typed when nothing was. */
	let typed = $state<string | null>(null);

	function start(event: FocusEvent & { currentTarget: HTMLInputElement }) {
		draft = value === null ? '' : display;
		editing = true;
		selectPending = true;
		typed = null;
		open = scrubbable;
		event.currentTarget.select();
	}

	/**
	 * A detent crossed, or a number taken off the strip.
	 *
	 * `onchange` per step and not `onpreview`, which is the same contract a held
	 * `+` already has: a scrub is a run of discrete steps, each one as committed
	 * as a tap on the arm, and the commit button lighting up has to follow the
	 * number the band is showing.
	 *
	 * `draft` is rewritten along with it, because the blur that closes the panel
	 * runs `commit()` and `commit()` reads `draft` — left alone it would still
	 * hold whatever was in the field when the ruler opened, and the whole gesture
	 * would be undone at the moment it ended.
	 */
	function scrub(next: number) {
		value = next;
		draft = String(next);
		typed = null;
		onchange?.(next);
	}

	function landing(): number | null {
		if (draft.trim() === '') {
			return null;
		}

		const parsed = parseEntry(draft);

		return parsed === null ? value : settle(parsed, min, max);
	}

	function commit() {
		editing = false;
		open = false;
		typed = null;

		const next = landing();
		if (next !== value) {
			value = next;
			onchange?.(next);
		}
	}

	/* Where the caret sat before the keystroke now landing, so that refusing one
	   can put the field back exactly as it stood. `input` is too late to read it:
	   the character is already in the box and the caret has already stepped over
	   it. A range and not a point, because focus selects the whole number — a
	   letter typed first has to leave that selection standing rather than
	   quietly collapsing it. */
	let caret: [number, number] = [0, 0];

	function aim(event: Event & { currentTarget: HTMLInputElement }) {
		const { selectionStart, selectionEnd } = event.currentTarget;

		caret = [selectionStart ?? 0, selectionEnd ?? 0];
	}

	/**
	 * Anything that is not a number on its way to being typed is refused outright
	 * — the character never appears, and a paste of `82,5 kg` lands nothing at
	 * all rather than half of itself.
	 *
	 * Refusing after the fact rather than cancelling the `beforeinput`: the
	 * result of an edit is only reliably knowable once it has happened. Every
	 * other route would mean reassembling the string per `inputType`, and a
	 * deletion, a drop, an undo and a composition each splice differently.
	 *
	 * The DOM is rewritten by hand because `draft` has not changed, so there is
	 * nothing for the `value={...}` above to react to and the junk would sit
	 * there unopposed.
	 */
	function oninput(event: Event & { currentTarget: HTMLInputElement }) {
		const field = event.currentTarget;

		if (!isEntryDraft(field.value)) {
			field.value = draft;
			field.setSelectionRange(caret[0], caret[1]);
			return;
		}

		draft = field.value;
		typed = draft;
		onpreview?.(landing());
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
		onclick={(event) => nudgeOnce(event, direction)}
		onpointerdown={() => holdStart(direction)}
		onpointerup={holdEnd}
		onpointerleave={holdEnd}
		onpointercancel={holdEnd}
		class={[
			'grid w-11 shrink-0 place-items-center text-2xl font-semibold focus-ring-inset',
			// `manipulation`, not `none`: a scroll that starts on the arm still
			// scrolls the page and arrives back here as a `pointercancel`. Taking
			// the gesture outright would make a fat target in the logging loop a
			// dead zone for the one thing every screen does.
			'touch-manipulation select-none',
			'text-ink-muted hover:bg-hover press:bg-surface-2 press:text-ink',
			corner
		]}
		{@attach press()}
	>
		{direction < 0 ? '−' : '+'}
	</button>
{/snippet}

<div
	class={['flex min-h-19 items-stretch rounded-2xl bg-sunken focus-ring-within', klass]}
	role="group"
	aria-label={label}
>
	{@render arm(-1, 'decrease', 'rounded-l-2xl')}

	<div class="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5">
		<!-- `scroll-mb` is load-bearing on a phone: the browser scrolls a focused
		     input clear of the keyboard it just raised, and the margin is what
		     makes it carry the commit bar underneath along with it. -->
		<input
			bind:this={box}
			value={editing ? draft : display}
			onbeforeinput={aim}
			{oninput}
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
			class={[
				'w-full scroll-mb-32 bg-transparent p-0 text-center text-2xl leading-none',
				// No ring of its own: the field's box wears it — `focus-ring-within`
				// on the wrapper — because a ring hugging the bare number read as a
				// fragment of the control lighting up.
				'font-extrabold tracking-numeral outline-hidden',
				// `accent-text` and not `accent`: this is the accent as a *string*, on
				// a surface, which is the distinction app.css draws between the two.
				touched ? 'text-accent-text' : 'text-ink'
			]}
		/>
		<!-- `nowrap`, and it is load-bearing rather than tidy: the column between the
		     two arms is 62px on a 360px phone and 42px on a 320px one, while
		     `KG / HAND` measures 63. Left to wrap it broke across two lines and took
		     the number up with it, so the weight and the reps beside it no longer
		     sat on the same line. The label is the one thing in the field allowed to
		     bleed past the column — it overhangs the dead space under the `−` and
		     `+`, which are centred a line above it, and the column paints after the
		     arms so a hover on one cannot cover it. -->
		<div class="label-caps whitespace-nowrap">{label}</div>
	</div>

	{@render arm(1, 'increase', 'rounded-r-2xl')}
</div>

<!-- Rendered here rather than at the app root, and it is only `position: fixed`
     that makes that legal: the panel has to stay inside the active set's card so
     that opening it is not a `focusout` of the card, which is what clears the
     commit button's live preview. Nothing inside it takes focus, so the field
     behind keeps it — and the keyboard with it — for as long as the panel is up.

     `recalled` is where an empty field starts the strip: last session's number is
     a far better place to begin a drag than 0 kg, and until a detent is crossed
     it is the ruler's cursor rather than the field's value. -->
{#if open}
	<Ruler
		value={value ?? recalled ?? min}
		{typed}
		{label}
		step={detent}
		{major}
		{min}
		{max}
		onscrub={scrub}
		onpick={(next) => {
			scrub(next);
			box?.blur();
		}}
		ondismiss={() => box?.blur()}
	/>
{/if}
