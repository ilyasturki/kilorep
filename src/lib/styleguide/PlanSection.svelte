<script lang="ts">
	import { catalogById } from '$lib/catalog';
	import {
		moveEntry,
		setExerciseReps,
		setExerciseRest,
		setPlannedReps,
		setSetCount
	} from '$lib/domain/template';
	import Card from '$lib/styleguide/Card.svelte';
	import Frame from '$lib/styleguide/Frame.svelte';
	import { caption } from '$lib/styleguide/chrome';
	import { bench, marks, pushTemplate } from '$lib/styleguide/fixtures';
	import PlanCard from '$lib/templates/PlanCard.svelte';
	import PlanLedger from '$lib/templates/PlanLedger.svelte';
	import TemplateMark from '$lib/templates/TemplateMark.svelte';
	import { plannedEntries } from '$lib/templates/plan';

	type Props = { onoptions: (anchor: HTMLElement) => void };

	let { onoptions }: Props = $props();

	let open = $state(true);

	// The plan edits for real: the ledger is the specimen, so a step that did not move a
	// number would be showing the control without its answer. Two templates, so the two cards
	// are not arguing about the same afternoon.
	const cardPlan = $state(pushTemplate());

	const template = $state(pushTemplate());

	const exercise = $derived(cardPlan.entries[0].exercises[0]);

	const entries = $derived(plannedEntries(template, catalogById));

	const mint = () => crypto.randomUUID();
</script>

<Card name="PlanCard" note="one exercise of a template — closed it is a row, open it is the fields">
	<Frame label="tap the row to open it; stepping the set count adds and drops rows">
		<div class="p-3">
			<PlanCard
				meta={bench}
				{exercise}
				{open}
				ontoggle={() => (open = !open)}
				{onoptions}
				onsets={(count) => setSetCount(cardPlan, exercise.id, count, mint)}
				onreps={(reps) => setExerciseReps(cardPlan, exercise.id, reps)}
				onsetreps={(setId, reps) => setPlannedReps(cardPlan, setId, reps)}
			/>
		</div>
	</Frame>
</Card>

<Card name="PlanLedger" note="the desktop's whole plan, one table" wide tall>
	<Frame
		label="desktop column — entries reorder by their grip; a superset travels as one"
		size="column"
		floor={640}
	>
		<div class="p-4">
			<PlanLedger
				{entries}
				onoptions={(_, anchor) => onoptions(anchor)}
				onsets={(id, count) => setSetCount(template, id, count, mint)}
				onreps={(id, reps) => setExerciseReps(template, id, reps)}
				onsetreps={(setId, reps) => setPlannedReps(template, setId, reps)}
				onrest={(id, seconds) => setExerciseRest(template, id, seconds)}
				oninsert={() => {}}
				onreorder={(entryId, index) => moveEntry(template, entryId, index)}
			/>
		</div>
	</Frame>
	<span class={caption}>
		one row per exercise — per-set rows only where the targets differ, or where the caret opens them
	</span>
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
