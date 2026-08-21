<script lang="ts" module>
	/**
	 * How far one tap on an arm travels: a number where the ladder is uniform, a function
	 * where it is not, asked for each jump — the rack it stands for decides how far the
	 * next one goes.
	 */
	export type Step = number | ((from: number, direction: number) => number);
</script>

<script lang="ts">
	import type { ClassValue } from 'svelte/elements';
	import { isEntryDraft, parseEntry, settle } from '$lib/domain/workout';
	import { tapHold } from '$lib/ui/feedback';
	import { coarsePointer } from '$lib/ui/pointer';
	import { press } from '$lib/ui/press';
	import Ruler from '$lib/ui/Ruler.svelte';

	type Props = {
		value: number | null;
		recalled?: number | null;
		// Where an empty field lands when an arm is tapped — a default worth waking to, rather
		// than one step off the floor. Absent, the arms count from `min` as they always did.
		seed?: number | null;
		label: string;
		step?: Step;
		min?: number;
		max?: number;
		ruler?: boolean;
		rulerStep?: number;
		major?: number;
		onchange?: (value: number | null) => void;
		onpreview?: (value: number | null) => void;
		class?: ClassValue;
	};

	let {
		value = $bindable(null),
		recalled = null,
		seed = null,
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

	const jump = (from: number, direction: number): number =>
		typeof step === 'function' ? step(from, direction) : step;

	// Not a destructuring default: that would read `step` while it is still being bound. The
	// ruler lays its rungs at one pitch, so an uneven ladder hands it the finest jump it has —
	// the one off the floor — or every value between two coarse rungs becomes unscrubbable.
	const detent = $derived(rulerStep ?? jump(min, 1));

	const scrubbable = $derived(ruler && coarsePointer);

	const touched = $derived(value !== recalled);

	const display = $derived(value === null ? '–' : String(settle(value, min, max)));

	function nudge(direction: number) {
		// Either arm wakes a seeded empty field onto the seed itself: an open rep target is
		// where every planned exercise starts, and the first tap there means "the usual".
		const from = value ?? min;
		const next =
			value === null && seed !== null
				? settle(seed, min, max)
				: settle(from + direction * jump(from, direction), min, max);
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

	const HOLD_DELAY = 350;
	const REPEAT_FROM = 180;
	const REPEAT_FLOOR = 50;
	const REPEAT_RAMP = 0.92;

	function holdStart(direction: number) {
		clearTimeout(timer);
		repeating = false;

		let delay = REPEAT_FROM;
		const tick = () => {
			if (!repeating) {
				tapHold();
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

	// The ruler renders inside the card: opening it must not be a `focusout` of the card,
	// and nothing in it takes focus, so the field keeps the keyboard.
	let open = $state(false);

	// `null` until the first keystroke: focus seeds `draft` too, so `draft` alone cannot
	// tell a typed value apart.
	let typed = $state<string | null>(null);

	function start(event: FocusEvent & { currentTarget: HTMLInputElement }) {
		draft = value === null ? '' : display;
		editing = true;
		selectPending = true;
		typed = null;
		event.currentTarget.select();
	}

	// A deliberate tap, never focus: the keyboard's next key hands focus to the field beside this
	// one, and it must not drag a ruler in behind it. A tap on an already-focused field still
	// opens, which focus alone would miss.
	function reveal() {
		open = scrubbable;
	}

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

	let caret: [number, number] = [0, 0];

	function aim(event: Event & { currentTarget: HTMLInputElement }) {
		const { selectionStart, selectionEnd } = event.currentTarget;

		caret = [selectionStart ?? 0, selectionEnd ?? 0];
	}

	// Refused after the fact: each `inputType` splices differently, so `beforeinput` is unreliable.
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
		<input
			bind:this={box}
			value={editing ? draft : display}
			onbeforeinput={aim}
			{oninput}
			onfocus={start}
			onblur={commit}
			onclick={reveal}
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
				'font-extrabold tracking-numeral outline-hidden',
				touched ? 'text-accent-text' : 'text-ink'
			]}
		/>
		<div class="label-caps whitespace-nowrap">{label}</div>
	</div>

	{@render arm(1, 'increase', 'rounded-r-2xl')}
</div>

{#if open}
	<Ruler
		value={value ?? recalled ?? seed ?? min}
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
