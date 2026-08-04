<script lang="ts">
	import type { Snippet } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { slide } from 'svelte/transition';

	import { PLANNED_REPS } from '$lib/domain/template';
	import type { TemplateExercise, TemplateSet } from '$lib/domain/template';
	import type { Exercise } from '$lib/domain/exercise';
	import { loadModeNote } from '$lib/exercises/label';
	import { planShape, repsLabel, setsLabel } from '$lib/templates/plan';
	import MiniStepper from '$lib/ui/MiniStepper.svelte';
	import CaretDown from '$lib/ui/icons/CaretDown.svelte';
	import More from '$lib/ui/icons/More.svelte';

	/**
	 * One planned exercise: what it is, how many sets, and the reps they ask for.
	 *
	 * The card prescribes at the exercise level, because that is the shape of
	 * almost every plan — three sets of eight, one number. It used to stack one
	 * full-width stepper per set, which meant a four-exercise push day was five
	 * screens of identical rows saying the same 8 four times each, and adding a
	 * fifth set meant finding the row under all of them.
	 *
	 * The per-set steppers are still here, one tap away behind the caret, for the
	 * pyramids and drop sets the exercise-wide arm cannot express. That arm goes
	 * inert the moment the sets disagree rather than flattening them: `planShape`
	 * owns which state the exercise is in, and the readout says so in words —
	 * `8–12 reps` for a pyramid, `Mixed` for a plan holding both numbers and open
	 * sets. Nothing on this card ever prints a number the plan does not hold.
	 *
	 * A target set is a target that can be dropped again, in one press, and the
	 * exercise's name is the way to its own page. Both have their reasons written
	 * where they are drawn.
	 *
	 * The grip arrives as a snippet: the drag belongs to the screen stacking
	 * these — it owns the order, the measurements and the flip — and a card that
	 * took four pointer handlers as props would be pretending otherwise.
	 */
	type Props = {
		meta: Exercise;
		exercise: TemplateExercise;
		grip: Snippet;
		/** The exercise itself: view it, swap it, or take it out of the plan. */
		onoptions: () => void;
		onaddset: () => void;
		/** Drop the last set. Never offered while one is left — that is a removal. */
		onremoveset: () => void;
		/** The shared target, across every set at once. */
		onreps: (reps: number | null) => void;
		onsetreps: (setId: string, reps: number | null) => void;
	};

	let { meta, exercise, grip, onoptions, onaddset, onremoveset, onreps, onsetreps }: Props =
		$props();

	const shape = $derived(planShape(exercise));

	// The caret's panel grows open rather than appearing — height only, no
	// fade, the same 200ms every expansion in the app settles on. Zero under
	// reduced motion, the standing idiom.
	const grow = $derived(prefersReducedMotion.current ? 0 : 200);

	// Live only while one number can honestly speak for every set. `open` counts:
	// the first + proposes the gym's default rather than a 1 nobody planned, and
	// there is nothing to flatten.
	const shared = $derived(shape.kind === 'open' || shape.kind === 'fixed');

	function raiseShared() {
		onreps(shape.reps === null ? PLANNED_REPS : shape.reps + 1);
	}

	// Stepping down through 1 clears back to open, so the whole range is
	// reachable from either end — the same walk the per-set arms make below.
	function lowerShared() {
		if (shape.reps === null) {
			return;
		}

		onreps(shape.reps === 1 ? null : shape.reps - 1);
	}

	function raiseSet(set: TemplateSet) {
		onsetreps(set.id, set.plannedReps === null ? PLANNED_REPS : set.plannedReps + 1);
	}

	function lowerSet(set: TemplateSet) {
		if (set.plannedReps === null) {
			return;
		}

		onsetreps(set.id, set.plannedReps === 1 ? null : set.plannedReps - 1);
	}

	// Closed on arrival, whatever the sets say. Opening it on a plan that already
	// varies was tried and reads as the card breaking: the same exercise is a
	// tall card on one screen and a short one on the next, and the collapsed line
	// already spells the range it would have been opened to explain.
	let expanded = $state(false);

	const panelId = $props.id();
</script>

<section class="flex flex-col gap-2 rounded-2xl border border-line-soft bg-surface p-3">
	<div class="flex items-center gap-1">
		<!-- The name is the way to the exercise page. An anchor and not a handler:
		     this is an ordinary navigation to an ordinary screen, so it middle-
		     clicks, opens in a tab and answers Enter the way every other link in
		     the app does. It takes the load-mode note with it — the two lines are
		     one thing being named, and a tap target that stopped at the baseline of
		     the first would be a strip of dead card under a live one.

		     Scoped to the title and no further. The rest of this card is steppers
		     and a grip, none of which is a navigation, and a whole-card link would
		     make every mis-touch on a stepper's edge leave the editor.

		     The heading stays a heading with the link inside it: the exercise's
		     name titles this section whether or not it is also a destination. -->
		<h2 class="min-w-0 flex-1">
			<a
				href="/exercises/{meta.id}"
				class="flex min-w-0 flex-col rounded-lg px-1 py-0.5 focus-ring hover:bg-surface-2
					active:bg-surface-2 pointer-fine:transition-[background-color]
					pointer-fine:duration-100"
			>
				<span class="truncate text-lg font-extrabold tracking-tight text-ink">{meta.name}</span>
				{#if loadModeNote(meta.loadMode)}
					<span class="truncate text-sm font-bold text-ink-faint">
						{loadModeNote(meta.loadMode)}
					</span>
				{/if}
			</a>
		</h2>

		<!-- Everything that happens to the exercise rather than to its plan, behind
		     one button: view it, swap it, remove it. It was a bare `×` for removal
		     alone, which left a swap nowhere to go — a third 44px control in this
		     header would have eaten the name it sits beside, on a card that is 327px
		     wide on a phone.

		     `More` and not a `×`, because this is the app's options glyph: the same
		     one a set row, an active set and a history section all wear for the same
		     gesture. The removal it used to be is two taps deeper now and asks
		     nothing on arrival — the menu naming the exercise is the deliberation
		     the dialog used to supply. -->
		<button
			type="button"
			aria-label="Options for {meta.name}"
			onclick={onoptions}
			class="grid size-11 shrink-0 place-items-center rounded-full text-ink-faint focus-ring
				hover:bg-surface-2 active:bg-surface-2"
		>
			<More size={20} />
		</button>

		{@render grip()}
	</div>

	<div class="flex items-center gap-2">
		<MiniStepper
			label="Sets"
			value={setsLabel(shape.sets)}
			ondec={shape.sets > 1 ? onremoveset : null}
			oninc={onaddset}
			class="flex-1"
		/>

		<MiniStepper
			label="Rep target"
			value={repsLabel(shape)}
			dim={shape.kind === 'open'}
			ondec={shared && shape.reps !== null ? lowerShared : null}
			oninc={shared ? raiseShared : null}
			class="flex-1"
		/>

		<!-- The way to the targets the shared arm refuses to write. It stays on a
		     card whose sets already agree, because opening it is also how a plan
		     *becomes* a pyramid. -->
		<button
			type="button"
			aria-expanded={expanded}
			aria-controls={panelId}
			aria-label="Per-set rep targets for {meta.name}"
			onclick={() => (expanded = !expanded)}
			class="grid size-11 shrink-0 place-items-center rounded-xl text-ink-faint focus-ring
				hover:bg-surface-2 active:bg-surface-2"
		>
			<CaretDown size={16} class={expanded ? 'rotate-180' : ''} />
		</button>
	</div>

	<!-- The way back out of a rep target, in one press.

	     `−` has always walked down to Open through 1, and that is eight taps from
	     the default 8 — a path that exists rather than one anybody takes. This is
	     the same act named: `setExerciseReps(…, null)`, the open target applied to
	     every set alike.

	     Its own row, at full 44px, rather than a fourth control beside the
	     steppers. The row above is two steppers and a caret in a card that is
	     327px wide on a phone, and the value between a stepper's arms is already
	     down to ~45px — enough for `8 reps` and not a character more. A fourth
	     arm there would cost the readouts the very numbers they print.

	     Only while there is a target to clear, so a card sitting at Open keeps the
	     height it has now. Offered on a range and on a mixed plan too, not just on
	     a single agreed number: those are exactly the states the shared stepper
	     above goes inert in, and without this there would be no way back from a
	     12/10/8 short of stepping three sets down by hand.

	     The accessible name carries the exercise — several cards on one screen
	     each saying "Clear target" tell a screen reader nothing about which — and
	     it opens with the visible words, so the two are one label. -->
	{#if shape.kind !== 'open'}
		<div class="flex justify-end">
			<button
				type="button"
				aria-label="Clear target for {meta.name}"
				onclick={() => onreps(null)}
				class="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-md font-bold
					text-ink-faint focus-ring hover:bg-surface-2 active:bg-surface-2"
			>
				<!-- `×` is a character the subset carries, same as the removal's above. -->
				<span aria-hidden="true" class="text-lg leading-none">×</span>
				Clear target
			</button>
		</div>
	{/if}

	{#if expanded}
		<!-- Two up wherever the column has the width for it, which from `sm` it
		     always does: these are short controls and a single file of them is the
		     stack this card was built to retire. -->
		<div
			id={panelId}
			transition:slide={{ duration: grow }}
			class="grid gap-2 px-1 pt-1 sm:grid-cols-2"
		>
			{#each exercise.sets as set, index (set.id)}
				<div class="flex items-center gap-2">
					<span class="w-11 shrink-0 label-caps">Set {index + 1}</span>

					<MiniStepper
						label="Set {index + 1} reps"
						value={set.plannedReps === null ? 'Open' : String(set.plannedReps)}
						dim={set.plannedReps === null}
						ondec={set.plannedReps === null ? null : () => lowerSet(set)}
						oninc={() => raiseSet(set)}
						class="flex-1"
					/>
				</div>
			{/each}
		</div>
	{/if}
</section>
