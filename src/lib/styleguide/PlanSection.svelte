<script lang="ts">
	import { catalogById } from '$lib/catalog';
	import type { TemplateExercise } from '$lib/domain/template';
	import Card from '$lib/styleguide/Card.svelte';
	import Frame from '$lib/styleguide/Frame.svelte';
	import { caption } from '$lib/styleguide/chrome';
	import { bench, marks, planExercise, pushTemplate } from '$lib/styleguide/fixtures';
	import PlanCard from '$lib/templates/PlanCard.svelte';
	import PlanList from '$lib/templates/PlanList.svelte';
	import TemplateMark from '$lib/templates/TemplateMark.svelte';
	import { plannedEntries } from '$lib/templates/plan';

	type Props = { onoptions: (anchor: HTMLElement) => void };

	let { onoptions }: Props = $props();

	let exercise = $state<TemplateExercise>(planExercise());

	// The plan reorders for real: the list is the specimen, so a drag that did not move
	// anything would be showing the gesture without its answer.
	const template = $state(pushTemplate());

	const entries = $derived(plannedEntries(template, catalogById));

	function setCount(count: number) {
		const sets = exercise.sets;

		while (sets.length > count) {
			sets.pop();
		}

		while (sets.length < count) {
			sets.push({ id: `ts-${sets.length + 1}`, plannedReps: sets.at(-1)?.plannedReps ?? 8 });
		}
	}

	function reorder(entryId: string, index: number) {
		const from = template.entries.findIndex((entry) => entry.id === entryId);

		if (from === -1 || from === index) {
			return;
		}

		const [moved] = template.entries.splice(from, 1);

		template.entries.splice(index, 0, moved);
	}
</script>

<Card name="PlanCard" note="one exercise of a template — sets, reps, rest" tall>
	<Frame label="stepping the set count adds and drops rows">
		<div class="p-3">
			<PlanCard
				meta={bench}
				{exercise}
				{onoptions}
				onsets={setCount}
				onreps={(reps) => exercise.sets.forEach((set) => (set.plannedReps = reps))}
				onsetreps={(setId, reps) => {
					const set = exercise.sets.find((candidate) => candidate.id === setId);

					if (set !== undefined) {
						set.plannedReps = reps;
					}
				}}
			/>
		</div>
	</Frame>
</Card>

<Card name="PlanList" note="DragList carrying a plan's entries" tall>
	<Frame label="hold a row or take its grip — the superset travels as one">
		<div class="p-3">
			<PlanList {entries} onjump={() => {}} oninsert={() => {}} onreorder={reorder} />
		</div>
	</Frame>
	<span class={caption}>the only DragList in the app — AddRow is built into its tail</span>
</Card>

<Card name="TemplateMark" note="the tile a plan is recognised by">
	<div class="flex flex-wrap items-center gap-4">
		{#each marks as mark (`${mark.icon}-${mark.colour}`)}
			<div class="flex flex-col items-center gap-1.5">
				<TemplateMark {mark} />
				<span class={caption}>{mark.icon ?? '—'} · {mark.colour ?? '—'}</span>
			</div>
		{/each}
	</div>
	<span class={caption}>a colour with no glyph fills; a glyph with no colour stays sunken</span>
</Card>
