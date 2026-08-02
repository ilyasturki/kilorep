<script lang="ts">
	import type { Snippet } from 'svelte';

	import { PLANNED_REPS } from '$lib/domain/template';
	import type { TemplateExercise, TemplateSet } from '$lib/domain/template';
	import type { Exercise } from '$lib/domain/exercise';
	import { loadModeNote } from '$lib/exercises/label';
	import { planShape, repsLabel, setsLabel } from '$lib/templates/plan';
	import MiniStepper from '$lib/ui/MiniStepper.svelte';
	import CaretDown from '$lib/ui/icons/CaretDown.svelte';

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
	 * The grip arrives as a snippet: the drag belongs to the screen stacking
	 * these — it owns the order, the measurements and the flip — and a card that
	 * took four pointer handlers as props would be pretending otherwise.
	 */
	type Props = {
		meta: Exercise;
		exercise: TemplateExercise;
		grip: Snippet;
		onremove: () => void;
		onaddset: () => void;
		/** Drop the last set. Never offered while one is left — that is a removal. */
		onremoveset: () => void;
		/** The shared target, across every set at once. */
		onreps: (reps: number | null) => void;
		onsetreps: (setId: string, reps: number | null) => void;
	};

	let { meta, exercise, grip, onremove, onaddset, onremoveset, onreps, onsetreps }: Props =
		$props();

	const shape = $derived(planShape(exercise));

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
		<div class="min-w-0 flex-1 px-1">
			<h2 class="truncate text-lg font-extrabold tracking-tight text-ink">{meta.name}</h2>
			{#if loadModeNote(meta.loadMode)}
				<p class="truncate text-sm font-bold text-ink-faint">{loadModeNote(meta.loadMode)}</p>
			{/if}
		</div>

		<!-- `×` is a character the subset carries. It asks first now — see the
		     screen's dialog for why the plan earned one. -->
		<button
			type="button"
			aria-label="Remove {meta.name}"
			onclick={onremove}
			class="grid size-11 shrink-0 place-items-center rounded-full text-xl leading-none
				text-ink-faint focus-ring hover:bg-surface-2 active:bg-surface-2"
		>
			×
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

	{#if expanded}
		<!-- Two up wherever the column has the width for it, which from `sm` it
		     always does: these are short controls and a single file of them is the
		     stack this card was built to retire. -->
		<div id={panelId} class="grid gap-2 px-1 pt-1 sm:grid-cols-2">
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
