<script lang="ts">
	import type { Exercise } from '$lib/domain/exercise';
	import { weightStep } from '$lib/domain/exercise';
	import { estimated1Rm, loadForReps } from '$lib/domain/stats';
	import type { PerformedSet } from '$lib/domain/workout';
	import { loadLabel, loadUnitLabel } from '$lib/exercises/label';
	import StepperField from '$lib/ui/StepperField.svelte';

	type Props = {
		exercise: Exercise;
		/** Body weight this exercise carries today, in kg — zero for everything a rack loads. */
		carried: number;
		/** Where the two fields open: the set the estimate above them came from. */
		seed: PerformedSet | null;
	};

	let { exercise, carried, seed }: Props = $props();

	// The rungs a lifter actually programs to. Not a table of every rep count: the answer is a
	// load to put on the bar today, and eleven of them is a spreadsheet rather than an answer.
	const TARGETS = [1, 3, 5, 8];

	// svelte-ignore state_referenced_locally
	let weight = $state<number | null>(seed?.weight ?? null);
	// svelte-ignore state_referenced_locally
	let reps = $state<number | null>(seed?.reps ?? null);

	const est = $derived(
		weight === null || reps === null ? null : estimated1Rm({ weight, reps, rpe: null }, carried)
	);

	const step = (from: number, direction: number): number =>
		weightStep(exercise.equipment, from, direction);

	/** Half a kilo: the finest thing any rack in the app steps by, and no false precision past it. */
	const rounded = (kg: number): number => Math.round(kg * 2) / 2;

	/**
	 * What goes on the belt for one set of `count` reps.
	 *
	 * The estimate is a load and the field is what was added, so the body comes back off on the
	 * way out. Below zero means the target is under an unloaded body — a rep count this lifter
	 * cannot reach on this movement yet — and a negative kilo is not a thing the app says.
	 */
	function rung(count: number): string {
		if (est === null) {
			return '–';
		}

		const added = loadForReps(est, count) - carried;

		return added <= 0 ? 'body' : loadLabel(rounded(added));
	}
</script>

<div class="flex flex-col gap-3 px-3 py-3">
	<!-- `recalled` is the set the fields opened on, so the accent means here what it means on the
	     logging card: this number is yours and no longer the one you were handed. -->
	<div class="grid grid-cols-1 gap-2 min-[22rem]:grid-cols-2">
		<StepperField
			label={loadUnitLabel(exercise)}
			bind:value={weight}
			recalled={seed?.weight ?? null}
			{step}
		/>
		<StepperField label="reps" bind:value={reps} recalled={seed?.reps ?? null} step={1} />
	</div>

	<!-- No estimate stated above the ladder: the 1RM rung is that number, and a screen that
	     says it twice is the second one asking to be read as something else. -->
	<div class="grid grid-cols-4 gap-1.5">
		{#each TARGETS as count (count)}
			<div class="flex flex-col items-center gap-0.5 rounded-lg bg-sunken px-1 py-1.5">
				<span class="text-md font-extrabold tracking-numeral tabular-nums">{rung(count)}</span>
				<span class="label-caps">{count}RM</span>
			</div>
		{/each}
	</div>

	<p class="px-1 text-sm font-bold text-ink-faint">
		{#if carried > 0}
			Epley, with the {loadLabel(carried)} kg your body carries here inside it. The rungs are what goes
			on the belt.
		{:else}
			Epley. The rungs are what one set of that many reps asks for.
		{/if}
	</p>
</div>
