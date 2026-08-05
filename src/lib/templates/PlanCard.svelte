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
	import { press } from '$lib/ui/press';

	type Props = {
		meta: Exercise;
		exercise: TemplateExercise;
		grip?: Snippet;
		onoptions: (anchor: HTMLElement) => void;
		onaddset: () => void;
		onremoveset: () => void;
		onreps: (reps: number | null) => void;
		onsetreps: (setId: string, reps: number | null) => void;
	};

	let { meta, exercise, grip, onoptions, onaddset, onremoveset, onreps, onsetreps }: Props =
		$props();

	const shape = $derived(planShape(exercise));

	const grow = $derived(prefersReducedMotion.current ? 0 : 200);

	const shared = $derived(shape.kind === 'open' || shape.kind === 'fixed');

	function raiseShared() {
		onreps(shape.reps === null ? PLANNED_REPS : shape.reps + 1);
	}

	/**
	 * `−` lowers the target, and the bottom of the scale is Open.
	 *
	 * That last clause is the whole of what used to be a "Clear target" button on
	 * a row of its own under this one. The row was there because a range or a
	 * mixed plan had no way back to Open at all — both arms are dead on those,
	 * since there is no single number to step from — so the only control that
	 * could reach Open was one that stood outside the stepper and duplicated its
	 * job.
	 *
	 * It is not the same journey from every kind, and it cannot be: from a fixed
	 * target `−` counts down and Open is the step past 1, while from a range or a
	 * mixed plan there is no number to count down *from*, so Open is the next step
	 * immediately. Both are the same sentence — the arm moves toward Open and gets
	 * there — and neither reading leaves a plan stuck with a target it cannot
	 * take back.
	 *
	 * `+` stays dead on a range and a mixed plan. Lowering an unequal target has
	 * an obvious floor to collapse to and raising it has no obvious ceiling, so
	 * the way back up is through Open and the per-set panel below, which is where
	 * an unequal target was written in the first place.
	 */
	function lowerShared() {
		if (shape.reps === null) {
			onreps(null);

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

	let expanded = $state(false);

	const panelId = $props.id();
</script>

<section class="flex flex-col gap-2 rounded-2xl border border-line-soft bg-surface p-3">
	<div class="flex items-center gap-1">
		<!-- The hold lands on the title and not on the card, because the card also
		     carries the steppers, and holding a + to add a set is not a request for
		     this exercise's menu. The title is the row that *is* the exercise. -->
		<h2 class="min-w-0 flex-1">
			<a
				href="/exercises/{meta.id}"
				class="flex min-w-0 press-sink flex-col rounded-lg px-1 py-0.5 focus-ring
					hover:bg-hover pointer-fine:transition-[background-color] pointer-fine:duration-100
					press:bg-surface-2"
				{@attach press(() => onoptions)}
			>
				<span class="truncate text-lg font-extrabold tracking-tight text-ink">{meta.name}</span>
				{#if loadModeNote(meta.loadMode)}
					<span class="truncate text-sm font-bold text-ink-faint">
						{loadModeNote(meta.loadMode)}
					</span>
				{/if}
			</a>
		</h2>

		<button
			type="button"
			aria-label="Options for {meta.name}"
			onclick={(e) => onoptions(e.currentTarget)}
			class="grid size-11 shrink-0 place-items-center rounded-full text-ink-faint focus-ring
				hover:bg-hover press:bg-surface-2"
			{@attach press()}
		>
			<More size={20} />
		</button>

		{@render grip?.()}
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
			ondec={shape.kind === 'open' ? null : lowerShared}
			oninc={shared ? raiseShared : null}
			class="flex-1"
		/>

		<button
			type="button"
			aria-expanded={expanded}
			aria-controls={panelId}
			aria-label="Per-set rep targets for {meta.name}"
			onclick={() => (expanded = !expanded)}
			class="grid size-11 shrink-0 place-items-center rounded-xl text-ink-faint focus-ring
				hover:bg-hover press:bg-surface-2"
			{@attach press()}
		>
			<CaretDown size={16} class={expanded ? 'rotate-180' : ''} />
		</button>
	</div>

	{#if expanded}
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
