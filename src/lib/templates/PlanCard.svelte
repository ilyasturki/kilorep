<script lang="ts">
	import type { Snippet } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { slide } from 'svelte/transition';

	import { restLabel } from '$lib/domain/rest';
	import { MAX_PLANNED_SETS, PLANNED_REPS } from '$lib/domain/template';
	import type { TemplateExercise } from '$lib/domain/template';
	import type { Exercise } from '$lib/domain/exercise';
	import { gripLabel } from '$lib/domain/grip';
	import { loadModeNote } from '$lib/exercises/label';
	import { restSettings } from '$lib/settings/rest.svelte';
	import { planShape, targetNote } from '$lib/templates/plan';
	import StepperField from '$lib/ui/StepperField.svelte';
	import CaretDown from '$lib/ui/icons/CaretDown.svelte';
	import More from '$lib/ui/icons/More.svelte';
	import { press } from '$lib/ui/press';

	type Props = {
		meta: Exercise;
		exercise: TemplateExercise;
		grip?: Snippet;
		onoptions: (anchor: HTMLElement) => void;
		onsets: (count: number) => void;
		onreps: (reps: number | null) => void;
		onsetreps: (setId: string, reps: number | null) => void;
	};

	let { meta, exercise, grip, onoptions, onsets, onreps, onsetreps }: Props = $props();

	const shape = $derived(planShape(exercise));

	// The prescribed grip reads under the name, where the load-mode note already sits: what a
	// plan asks for has to be visible without opening the menu that sets it.
	const setup = $derived(
		[loadModeNote(meta.loadMode), gripLabel(meta, exercise.grip)].filter(Boolean).join(' · ')
	);

	const restNote = $derived.by(() => {
		if (!restSettings.current.enabled || exercise.restSeconds === undefined) {
			return null;
		}

		return exercise.restSeconds === null
			? 'No rest'
			: `Rest ${restLabel(exercise.restSeconds * 1000)}`;
	});

	const grow = $derived(prefersReducedMotion.current ? 0 : 200);

	const notes = $derived([targetNote(shape), restNote].filter((note) => note !== null).join(' · '));

	let expanded = $state(false);

	const panelId = $props.id();
</script>

<section class="flex flex-col gap-2 rounded-2xl bg-surface p-3">
	<div class="flex items-center gap-1">
		<h2 class="min-w-0 flex-1">
			<a
				href="/plan/exercises/{meta.id}"
				class="flex min-w-0 press-sink flex-col rounded-lg px-1 py-0.5 focus-ring
					hover:bg-hover pointer-fine:transition-[background-color] pointer-fine:duration-100
					press:bg-surface-2"
				{@attach press(() => onoptions)}
			>
				<span class="truncate text-lg font-extrabold tracking-tight text-ink">{meta.name}</span>
				{#if setup}
					<span class="truncate text-sm font-bold text-ink-faint">{setup}</span>
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

	<!-- Every field is handed its own number as `recalled`: a plan has no hint to differ from —
	     what is on screen is what is stored — so the accent that means "you moved this off last
	     time" stays out of the planning surface. The count is bound through the plan rather than
	     held in the field, so a cleared box lands back on the sets there are: a planned exercise
	     with no sets is not a state, and there is no seed to wake it onto. -->
	<div class="flex items-stretch gap-2">
		<StepperField
			bind:value={
				() => shape.sets,
				(count) => {
					if (count !== null) {
						onsets(count);
					}
				}
			}
			recalled={shape.sets}
			label="sets"
			step={1}
			min={1}
			max={MAX_PLANNED_SETS}
			ruler
			class="flex-1"
		/>

		<StepperField
			label="reps"
			value={shape.reps}
			recalled={shape.reps}
			seed={PLANNED_REPS}
			step={1}
			min={1}
			ruler
			onchange={onreps}
			class="flex-1"
		/>

		<button
			type="button"
			aria-expanded={expanded}
			aria-controls={panelId}
			aria-label="Per-set rep targets for {meta.name}"
			onclick={() => (expanded = !expanded)}
			class="grid size-11 shrink-0 place-items-center self-center rounded-xl text-ink-faint
				focus-ring hover:bg-hover press:bg-surface-2"
			{@attach press()}
		>
			<CaretDown size={16} class={expanded ? 'rotate-180' : ''} />
		</button>
	</div>

	{#if notes !== ''}
		<p class="px-1 text-sm font-bold text-ink-faint">{notes}</p>
	{/if}

	{#if expanded}
		<div
			id={panelId}
			transition:slide={{ duration: grow }}
			class="grid gap-2 px-1 pt-1 sm:grid-cols-2"
		>
			{#each exercise.sets as set, index (set.id)}
				<div class="flex items-center gap-2">
					<span class="w-11 shrink-0 label-caps">Set {index + 1}</span>

					<StepperField
						label="reps"
						value={set.plannedReps}
						recalled={set.plannedReps}
						seed={PLANNED_REPS}
						step={1}
						min={1}
						ruler
						onchange={(reps) => onsetreps(set.id, reps)}
						class="flex-1"
					/>
				</div>
			{/each}
		</div>
	{/if}
</section>
