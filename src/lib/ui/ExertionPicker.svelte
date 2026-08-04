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

	/**
	 * How hard the set was — the one optional thing the logging card asks.
	 *
	 * Collapsed to a pill by default, and that is the whole design. Rule 7 says
	 * nothing may add friction to the logging loop, and a chip row parked
	 * permanently between the fields and the commit button would push the target
	 * of the very next tap sixty pixels further from the thumb on every set,
	 * rated or not. Collapsed, a lifter who never rates a set pays nothing at all
	 * — the card is the height it always was — and one who does pays two taps.
	 *
	 * Both callers stand the pill on the commit bar's own line, which is why the
	 * two open views carry `basis-full`: in a wrapping row that is what puts an
	 * expanded control back on a line of its own and pushes the bar below it.
	 *
	 * Three views, one control: the pill, the chips, and the stepper for a value
	 * off the ladder. `mode` is local and resets with the component, which is
	 * keyed on the set id by both callers — so a new set always opens collapsed
	 * rather than inheriting the view the last one was left in.
	 *
	 * Nothing here holds the value. Every pick goes straight out through
	 * `onchange` and comes back down as `value`, the same round trip
	 * `StepperField` makes, so the pill and the row above it cannot disagree
	 * about what the set holds.
	 */
	type Props = {
		/** The rating as stored — always RPE, whatever the chips are wearing. */
		value: number | null;
		scale: ExertionScale;
		onchange: (rpe: number | null) => void;
	};

	let { value, scale, onchange }: Props = $props();

	let mode = $state<'pill' | 'chips' | 'custom'>('pill');

	/**
	 * The rating, or null — normalised once here so the three views below can all
	 * test against null and mean it.
	 *
	 * A set logged before ratings existed carries no `rpe` field at all, and the
	 * history editor hands this component a set read straight back out of the
	 * store, where the type is asserted rather than checked. Without this the
	 * absent field would reach the stepper and settle to `NaN`.
	 */
	const rating = $derived(isExertion(value) ? value : null);

	const name = $derived(scaleName(scale));

	/**
	 * The pill wears the number and the scale on two lines, the dress the two
	 * fields beside it wear — so what it shows is the bare value, and `–` for a
	 * set nobody rated.
	 *
	 * Which leaves the accessible name to put the two halves back together, and
	 * to say what the button *does*: read aloud, `8.5` over `RPE` is two labels
	 * on a control with no verb.
	 */
	const shown = $derived(rating === null ? '–' : String(shownExertion(rating, scale)));
	const rated = $derived(exertionLabel(rating, scale));
	const pillLabel = $derived(
		rated === null ? `Rate this set in ${name}` : `Rated ${rated}, change it`
	);

	/**
	 * The rungs in the language the user reads them in. Stored order is kept —
	 * ascending RPE, so harder is always to the right — which under RIR runs the
	 * numbers downward. That is the honest rendering: the row means one thing and
	 * the two scales are two names for it, so reversing the order under one of
	 * them would make the same chip sit in two different places depending on a
	 * setting.
	 */
	const rungs = $derived(EXERTION_RUNGS.map((rpe) => String(shownExertion(rpe, scale))));

	/**
	 * Which chip is lit. Empty for unrated *and* for a value the ladder does not
	 * carry — a custom 6.5 lights nothing, and the pill is what shows it.
	 */
	const selected = $derived(
		rating !== null && EXERTION_RUNGS.includes(rating) ? String(shownExertion(rating, scale)) : ''
	);

	/**
	 * A chip tap. Bits UI answers a tap on the lit chip with an empty string,
	 * which is how a rating is taken back off a set — no separate gesture to
	 * learn, and the one path that works from every state is the `–` chip beside
	 * the rungs.
	 *
	 * `custom` is not a value and never lands on the set; it swaps the view.
	 */
	function pick(next: string) {
		if (next === 'custom') {
			mode = 'custom';

			return;
		}

		onchange(next === 'clear' || next === '' ? null : storedExertion(Number(next), scale));
		mode = 'pill';
	}
</script>

{#if mode === 'pill'}
	<!-- A third slab in the card's own grammar: the value over its caps name, the
	     shape and the fill `StepperField` already uses, one fixed width so the
	     commit button beside it never shifts under the thumb when the number
	     gains a half step. Narrower than a field and without arms, because it is
	     the optional number of the three and must not read as a fourth thing to
	     answer.

	     A step down in type from the fields, too — 22 against their 28. The value
	     goes accent-*text* rather than an accent fill: `Button`'s standing rule is
	     one filled control per screen, and that is the commit bar sharing this
	     line. -->
	<button
		type="button"
		aria-label={pillLabel}
		onclick={() => (mode = 'chips')}
		class={[
			'flex min-h-11 w-20 shrink-0 flex-col items-center justify-center gap-0.5',
			'rounded-2xl bg-sunken focus-ring hover:bg-hover active:bg-surface-2',
			'pointer-fine:transition-[background-color] pointer-fine:duration-100'
		]}
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
{:else if mode === 'chips'}
	<!-- `wrap` and not the scrolling `row`: nine chips scroll to about a screen
	     and a half on a phone, and a swipe to reach RPE 10 is the precision
	     gesture mid-set that DESIGN.md rules out. Two short rows, every rung
	     under a thumb, and the whole thing is gone again after one tap. -->
	<ChipGroup
		bind:value={() => selected, pick}
		layout="wrap"
		label="{name} for this set"
		class="basis-full py-0.5"
	>
		<!-- The one clear that works from everywhere. Tapping the lit rung clears
		     too, but a value off the ladder lights no rung and would otherwise be
		     stuck on the set. -->
		<Chip value="clear">–</Chip>

		<!-- Keyed on the shown number, which is unique per rung under both scales:
		     `10 − x` is injective, so no two rungs ever collide. -->
		{#each rungs as rung (rung)}
			<Chip value={rung}>{rung}</Chip>
		{/each}

		<!-- `⋯` is absent from the latin subset — the icons README measured it — so
		     the escape hatch is worded. It is also the clearer label: this chip
		     does not set a value, it opens the way to one. -->
		<Chip value="custom">Other</Chip>
	</ChipGroup>
{:else}
	<div class="flex basis-full items-stretch gap-2">
		<!-- `‹` is a character, like `BackLink`'s and the month arrows' — measured
		     present in the shipped subset, and the icons README's first rule is that
		     a glyph the font carries never becomes a component. -->
		<button
			type="button"
			aria-label="Back to the {name} chips"
			onclick={() => (mode = 'chips')}
			class="grid w-11 shrink-0 place-items-center rounded-2xl bg-sunken text-2xl leading-none
				font-bold text-ink-muted focus-ring hover:bg-hover active:bg-surface-2 active:text-ink"
		>
			‹
		</button>

		<!-- The loop's own field, at the loop's own size: half steps, and bounded
		     at both ends because a rating has a ceiling where a weight does not.
		     Blur lands the value, so the arms and a typed entry agree — and the
		     bounds are read in the *shown* space, which is what makes `+` mean an
		     easier set under RIR and a harder one under RPE. -->
		<StepperField
			label={name}
			value={rating === null ? null : shownExertion(rating, scale)}
			recalled={null}
			step={EXERTION_STEP}
			min={shownMin(scale)}
			max={shownMax(scale)}
			class="flex-1"
			onchange={(v) => onchange(v === null ? null : storedExertion(v, scale))}
		/>
	</div>
{/if}
