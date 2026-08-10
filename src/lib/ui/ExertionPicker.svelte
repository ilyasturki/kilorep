<script lang="ts">
	import {
		EXERTION_RUNGS,
		exertionLabel,
		isExertion,
		scaleName,
		shownExertion,
		shownMax,
		shownMin,
		storedExertion,
		EXERTION_STEP
	} from '$lib/domain/exertion';
	import type { ExertionScale } from '$lib/domain/exertion';
	import Chip from '$lib/ui/Chip.svelte';
	import ChipGroup from '$lib/ui/ChipGroup.svelte';
	import StepperField from '$lib/ui/StepperField.svelte';
	import More from '$lib/ui/icons/More.svelte';
	import { press } from '$lib/ui/press';

	type Props = {
		value: number | null;
		scale: ExertionScale;
		onchange: (rpe: number | null) => void;
	};

	let { value, scale, onchange }: Props = $props();

	let mode = $state<'pill' | 'chips' | 'custom'>('pill');

	/** The expanded control, and the test for what counts as a tap outside it. */
	let box = $state<HTMLElement | null>(null);

	/** The chip that clears. Not a rating, so it never collides with a rung. */
	const CLEAR = '-';

	const rating = $derived(isExertion(value) ? value : null);

	const name = $derived(scaleName(scale));

	const shown = $derived(rating === null ? '–' : String(shownExertion(rating, scale)));
	const rated = $derived(exertionLabel(rating, scale));
	const pillLabel = $derived(
		rated === null ? `Rate this set in ${name}` : `Rated ${rated}, change it`
	);

	const rungs = $derived(EXERTION_RUNGS.map((rpe) => String(shownExertion(rpe, scale))));

	const selected = $derived(
		rating !== null && EXERTION_RUNGS.includes(rating) ? String(shownExertion(rating, scale)) : ''
	);

	/**
	 * Two ways to clear and they arrive here as two strings: `CLEAR` is the dash
	 * tapped, and `''` is the toggle group deselecting itself when the lit chip
	 * is tapped again. The gesture was always there; the chip is what makes it
	 * something a thumb can find, and the only thing that reaches a rating which
	 * lights no chip at all — clearing a custom 6 used to mean opening ⋯ and
	 * emptying the field.
	 *
	 * It fits because 7.5 stopped asking for a slot. Eight items fill four
	 * columns exactly and nine do not, so the grid is a budget the scale spends:
	 * six rungs, the dash, and ⋯. See `EXERTION_RUNGS`.
	 */
	function pick(next: string) {
		if (next === 'custom') {
			mode = 'custom';

			return;
		}

		onchange(next === '' || next === CLEAR ? null : storedExertion(Number(next), scale));
		mode = 'pill';
	}

	/**
	 * Everything that puts the control away without touching the rating.
	 *
	 * Escape first, and only the second one when a field has focus: the stepper
	 * behind ⋯ answers the first press itself by reverting what was typed, and a
	 * key that undid an edit and closed the control in one press would be two
	 * acts on one press. Once the field has let go — target is the body — the
	 * next Escape is this one's.
	 *
	 * Then the tap outside, which is two listeners because the parts of it want
	 * different phases. `pointerdown` decides *whether* the tap is outside,
	 * while the thing it landed on is still where the finger found it; `click`
	 * decides *when* the control closes, which has to be after the tap has done
	 * its own job. Collapsing on the press instead would move the commit button
	 * up into the pill's row between the finger going down and coming up, and
	 * the tap that was aimed at logging the set would land on nothing.
	 *
	 * Capture on the click for the same reason it is safe to close there: the
	 * event's path is fixed when dispatch begins, so the button still gets its
	 * turn even though this ran first and the layout is about to change under
	 * it. A keyboard-activated click brings no `pointerdown` and so closes
	 * nothing — that is Escape's job, and it has it.
	 *
	 * Armed only while expanded, which is also what keeps the tap that opened
	 * the control from immediately closing it: that press was over before this
	 * effect existed.
	 */
	$effect(() => {
		if (mode === 'pill') {
			return;
		}

		let outside = false;

		function down(event: PointerEvent) {
			const target = event.target;

			outside = !(target instanceof Node) || box === null || !box.contains(target);
		}

		function up() {
			if (outside) {
				mode = 'pill';
			}
		}

		function key(event: KeyboardEvent) {
			if (event.key !== 'Escape' || event.target instanceof HTMLInputElement) {
				return;
			}

			mode = 'pill';
		}

		const listening = new AbortController();
		const signal = listening.signal;

		document.addEventListener('pointerdown', down, { capture: true, signal });
		document.addEventListener('click', up, { capture: true, signal });
		document.addEventListener('keydown', key, { signal });

		return () => listening.abort();
	});

	/**
	 * One height for both expanded states, so entering and leaving ⋯ does not
	 * move the commit button underneath — a button that shifts under a thumb
	 * already travelling toward it is the logging loop's own kind of bug.
	 *
	 * Under a thumb the chip grid is the tall one: two rows of `chip` plus the
	 * `gap-2` between them. Written as a calc off the token rather than as 112px,
	 * so it still fits when the OS text size grows the chips. At a fine pointer
	 * the chips are one 40px line and the stepper's 76px is the tall one instead,
	 * which is what `min-h-19` restores.
	 *
	 * Alignment is not in here, and deliberately: the chips are centred in the box
	 * so a desk's one-line row is never stretched into slabs, and the custom row
	 * fills it, because a stepper as tall as the box is a fatter target and
	 * nothing else is competing for the space. Two `align-items` utilities in one
	 * class list would be settled by Tailwind's own ordering rather than by which
	 * was written last, so the mode picks one and only one is ever emitted.
	 */
	const reserved =
		'flex basis-full min-h-[calc(2*var(--spacing-chip)+0.5rem)] pointer-fine:min-h-19';
</script>

{#if mode === 'pill'}
	<button
		type="button"
		aria-label={pillLabel}
		onclick={() => (mode = 'chips')}
		class={[
			'flex min-h-11 w-20 shrink-0 flex-col items-center justify-center gap-0.5',
			'rounded-2xl bg-sunken focus-ring hover:bg-hover press:bg-surface-2',
			'pointer-fine:transition-[background-color] pointer-fine:duration-100'
		]}
		{@attach press()}
	>
		<span
			class={[
				'text-xl leading-none font-extrabold tracking-numeral',
				rating === null ? 'text-ink-faint' : 'text-accent-text'
			]}
		>
			{shown}
		</span>
		<span class="label-caps">{name}</span>
	</button>
{:else}
	<!-- One box for both expanded states, and not one per state: it is what a
	     tap has to miss to count as outside, and a box that were replaced on the
	     way into ⋯ would make that move look like a tap on nothing. -->
	<div
		bind:this={box}
		class={[reserved, mode === 'chips' ? 'items-center' : 'items-stretch gap-2']}
	>
		{#if mode === 'chips'}
			<ChipGroup
				bind:value={() => selected, pick}
				layout="rungs"
				label="{name} for this set"
				class="w-full"
			>
				<!-- The dash leads, where the pill's own unrated face puts it. -->
				<Chip value={CLEAR} column aria-label="Clear the {name}">–</Chip>

				{#each rungs as rung (rung)}
					<Chip value={rung} column>{rung}</Chip>
				{/each}

				<Chip value="custom" column aria-label="Other {name} value">
					<More size={20} />
				</Chip>
			</ChipGroup>
		{:else}
			<button
				type="button"
				aria-label="Back to the {name} chips"
				onclick={() => (mode = 'chips')}
				class="grid w-11 shrink-0 place-items-center rounded-2xl bg-sunken text-2xl leading-none
					font-bold text-ink-muted focus-ring hover:bg-hover press:bg-surface-2 press:text-ink"
				{@attach press()}
			>
				‹
			</button>

			<StepperField
				label={name}
				value={rating === null ? null : shownExertion(rating, scale)}
				recalled={null}
				step={EXERTION_STEP}
				min={shownMin(scale)}
				max={shownMax(scale)}
				ruler
				class="flex-1"
				onchange={(v) => onchange(v === null ? null : storedExertion(v, scale))}
			/>
		{/if}
	</div>
{/if}
