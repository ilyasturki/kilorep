<script lang="ts" module>
	import { isEntryDraft, parseEntry, settle } from '$lib/domain/workout';

	/**
	 * How far one tap on an arm travels: a number where the ladder is uniform, a function
	 * where it is not, asked for each jump — the rack it stands for decides how far the
	 * next one goes.
	 */
	export type Step = number | ((from: number, direction: number) => number);

	/**
	 * What the number in the box is made of. A weight is a number and reads as one, so the
	 * default below is the whole story for most of the app; a field that counts in something
	 * else — a rest, which is a clock — hands over its own reading, writing and rounding here
	 * rather than growing a branch inside the control for every unit there might be.
	 */
	export type Entry = {
		/** What the box should show, given the raw text it now holds. `null` refuses the keystroke. */
		draft: (raw: string) => string | null;
		parse: (raw: string) => number | null;
		format: (value: number) => string;
		/** Where a value lands after every step, scrub and commit. Absent, wherever it fell. */
		snap?: (value: number) => number;
		inputmode?: 'decimal' | 'numeric';
	};

	export const NUMBER: Entry = {
		draft: (raw) => (isEntryDraft(raw) ? raw : null),
		parse: parseEntry,
		format: String,
		inputmode: 'decimal'
	};
</script>

<script lang="ts">
	import type { ClassValue } from 'svelte/elements';
	import { tapHold } from '$lib/ui/feedback';
	import { coarsePointer } from '$lib/ui/pointer';
	import { press } from '$lib/ui/press';
	import Ruler from '$lib/ui/Ruler.svelte';

	type Props = {
		value: number | null;
		// What last time's number was, and the thing the accent marks a departure from. Left
		// unsaid where there is no last time — a stored default is only ever itself — which is
		// not the same as passing `null`, which says nothing was recalled and so anything here
		// is a departure.
		recalled?: number | null;
		// Where an empty field lands when an arm is tapped — a default worth waking to, rather
		// than one step off the floor. Absent, the arms count from `min` as they always did.
		seed?: number | null;
		label: string;
		step?: Step;
		min?: number;
		max?: number;
		entry?: Entry;
		// The settings row's footprint: the same card at a chip's height, with the label already
		// spoken by the row beside it and no room under the number to repeat it.
		compact?: boolean;
		disabled?: boolean;
		// Whether an emptied box means anything. A set that has not been entered is a real state
		// and reads `–`; a rest that is off is said with a switch, not by clearing the duration.
		nullable?: boolean;
		ruler?: boolean;
		rulerStep?: number;
		major?: number;
		onchange?: (value: number | null) => void;
		onpreview?: (value: number | null) => void;
		class?: ClassValue;
	};

	let {
		value = $bindable(null),
		recalled,
		seed = null,
		label,
		step = 2.5,
		min = 0,
		max = Infinity,
		entry = NUMBER,
		compact = false,
		disabled = false,
		nullable = true,
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

	const scrubbable = $derived(ruler && coarsePointer && !disabled);

	const touched = $derived(recalled !== undefined && value !== recalled);

	// Inside the range, and then on the ladder. Clamped either side of the snap because a unit
	// that rounds outward — a rest at 9:56 reaching for 10:00 — would otherwise step past the
	// ceiling on its way to the nearest rung.
	function land(raw: number): number {
		const settled = settle(raw, min, max);

		return entry.snap === undefined ? settled : settle(entry.snap(settled), min, max);
	}

	// Honest about what is stored rather than about where the arms can go: a duration that
	// arrived off the ladder — an older sync, a record edited by hand — reads as the seconds it
	// is and joins the fifteens on the first tap, instead of being quietly redrawn as one of
	// them while the store still holds the other.
	const display = $derived(value === null ? '–' : entry.format(settle(value, min, max)));

	// An arm that cannot move is shown dead rather than left to be discovered. Never over an
	// empty field: there the first tap has somewhere to go — the seed, or the floor.
	const atFloor = $derived(value !== null && value <= min);
	const atCeiling = $derived(value !== null && value >= max);

	function nudge(direction: number) {
		// Either arm wakes a seeded empty field onto the seed itself: an open rep target is
		// where every planned exercise starts, and the first tap there means "the usual".
		const from = value ?? min;
		const next =
			value === null && seed !== null ? land(seed) : land(from + direction * jump(from, direction));
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

	let box = $state<HTMLInputElement | null>(null);

	// The ruler renders inside the card: opening it must not be a `focusout` of the card,
	// and nothing in it takes focus, so the field keeps the keyboard.
	let open = $state(false);

	// `null` until the first keystroke, and what stands between a field left alone and a field
	// cleared on purpose: an empty `draft` is the state focus itself puts the input in.
	let typed = $state<string | null>(null);

	// The number steps aside rather than being selected. Selecting it was the honest way to say
	// "type and this goes", but on Android a selection is an action mode: handles under the
	// glyphs and a Cut / Copy / Select all / Read aloud bar thrown over the ruler, none of which
	// belongs on a weight. An empty field with the number behind it as a placeholder says the
	// same thing — the first keystroke replaces it — and gives the OS nothing to decorate.
	function start() {
		draft = '';
		editing = true;
		typed = null;
	}

	// A deliberate tap, never focus: the keyboard's next key hands focus to the field beside this
	// one, and it must not drag a ruler in behind it. A tap on an already-focused field still
	// opens, which focus alone would miss.
	function reveal() {
		open = scrubbable;
	}

	function scrub(next: number) {
		value = next;
		draft = entry.format(next);
		typed = null;
		onchange?.(next);
	}

	function landing(): number | null {
		if (draft.trim() === '') {
			return null;
		}

		const parsed = entry.parse(draft);

		return parsed === null ? value : land(parsed);
	}

	function commit() {
		// Nothing was typed, so there is nothing to land: the field held a ghost the whole time,
		// and reading an empty draft as a cleared number would wipe the value on a stray tap.
		// An arm tapped or a rung scrubbed while focused has already written what it meant.
		const untouched = typed === null;

		editing = false;
		open = false;
		typed = null;

		if (untouched) {
			return;
		}

		const next = landing();

		// A field with nothing to clear to keeps what it had: the box was emptied on the way to
		// typing something else, and the thumb left before the something else arrived.
		if (next === null && !nullable) {
			return;
		}

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
		const next = entry.draft(field.value);

		if (next === null) {
			field.value = draft;
			field.setSelectionRange(caret[0], caret[1]);
			return;
		}

		draft = next;
		typed = next;

		// A field that rewrites what was typed — a clock growing its own colon — has moved every
		// glyph after the caret, so there is nowhere left to put it back but the end.
		if (next !== field.value) {
			field.value = next;
			field.setSelectionRange(next.length, next.length);
		}

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

<!-- The arm is `44px` and not `w-11`: a thumb is the same width whoever's phone this is, and OS
     text scaling growing it is the one thing the pair cannot afford — every pixel an arm takes is
     one the number beside it loses, and there are four arms across the card. Height still follows
     the scale (`min-h-19` on the row), because down the page there is room. Compact is the other
     way around — one field to a row, the label already said beside it — so its arms may scale. -->
{#snippet arm(direction: number, verb: string, corner: string)}
	<button
		type="button"
		aria-label="{verb} {label}"
		disabled={disabled || (direction < 0 ? atFloor : atCeiling)}
		onclick={(event) => nudgeOnce(event, direction)}
		onpointerdown={() => holdStart(direction)}
		onpointerup={holdEnd}
		onpointerleave={holdEnd}
		onpointercancel={holdEnd}
		class={[
			'grid shrink-0 place-items-center font-semibold focus-ring-inset',
			'touch-manipulation select-none',
			'text-ink-muted hover:bg-hover press:bg-surface-2 press:text-ink',
			'disabled:pointer-events-none disabled:opacity-40',
			compact ? 'w-11 text-xl' : 'w-[44px] text-2xl',
			corner
		]}
		{@attach press()}
	>
		{direction < 0 ? '−' : '+'}
	</button>
{/snippet}

<div
	class={[
		'flex items-stretch bg-sunken focus-ring-within',
		compact ? 'min-h-11 rounded-xl' : 'min-h-19 rounded-2xl',
		klass
	]}
	role="group"
	aria-label={label}
>
	{@render arm(-1, 'decrease', compact ? 'rounded-l-xl' : 'rounded-l-2xl')}

	<div
		class={[
			'flex min-w-0 flex-1 items-center justify-center',
			!compact && '@container flex-col gap-0.5'
		]}
	>
		<input
			bind:this={box}
			value={editing ? draft : display}
			placeholder={display}
			{disabled}
			onbeforeinput={aim}
			{oninput}
			onfocus={start}
			onblur={commit}
			onclick={reveal}
			{onkeydown}
			inputmode={entry.inputmode ?? 'decimal'}
			autocomplete="off"
			aria-label={label}
			class={[
				'w-full scroll-mb-32 bg-transparent p-0 text-center',
				'font-extrabold tracking-numeral outline-hidden',
				// Safari greys a disabled input through the fill colour, where `color` cannot reach
				// it. The row above says "off" by dimming as a whole, and says it once.
				'[-webkit-text-fill-color:currentColor]',
				// The ghost is the number the field is holding, so it must not read as a hint about
				// what to type: same weight and size, one step back in ink.
				'placeholder:text-ink-faint',
				compact ? 'text-md' : 'numeral-fit',
				touched ? 'text-accent-text' : 'text-ink'
			]}
		/>
		{#if !compact}
			<div class="label-caps whitespace-nowrap">{label}</div>
		{/if}
	</div>

	{@render arm(1, 'increase', compact ? 'rounded-r-xl' : 'rounded-r-2xl')}
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
		format={entry.format}
		parse={entry.parse}
		onscrub={scrub}
		onpick={(next) => {
			scrub(next);
			box?.blur();
		}}
		ondismiss={() => box?.blur()}
	/>
{/if}
