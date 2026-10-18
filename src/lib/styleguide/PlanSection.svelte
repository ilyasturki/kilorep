<script lang="ts">
	import { catalogById } from '$lib/catalog';
	import {
		moveEntry,
		setEntryRest,
		setExerciseReps,
		setPlannedReps,
		setSetCount
	} from '$lib/domain/template';
	import Card from '$lib/styleguide/Card.svelte';
	import Frame from '$lib/styleguide/Frame.svelte';
	import Spec from '$lib/styleguide/Spec.svelte';
	import { caption } from '$lib/styleguide/chrome';
	import { bench, driftedWorkout, marks, pushTemplate } from '$lib/styleguide/fixtures';
	import PlanCard from '$lib/templates/PlanCard.svelte';
	import PlanLedger from '$lib/templates/PlanLedger.svelte';
	import PlanRestField from '$lib/templates/PlanRestField.svelte';
	import PlanOffer from '$lib/templates/PlanOffer.svelte';
	import TemplateMark from '$lib/templates/TemplateMark.svelte';
	import { restSettings } from '$lib/settings/rest.svelte';
	import { entryRest, plannedEntries, planDefaultRest } from '$lib/templates/plan';

	type Props = { onoptions: (anchor: HTMLElement) => void };

	let { onoptions }: Props = $props();

	let open = $state(true);

	// The plan edits for real: the ledger is the specimen, so a step that did not move a
	// number would be showing the control without its answer. Two templates, so the two cards
	// are not arguing about the same afternoon.
	const cardPlan = $state(pushTemplate());

	const template = $state(pushTemplate());

	const exercise = $derived(cardPlan.entries[0].exercises[0]);

	const cardEntry = $derived(plannedEntries(cardPlan, catalogById)[0]);

	const entries = $derived(plannedEntries(template, catalogById));

	const mint = () => crypto.randomUUID();

	let planRest = $state<number | null>();

	const drifted = driftedWorkout();

	const offerPlan = pushTemplate();

	// Keyed so a dismissed specimen can be brought back.
	let offerRound = $state(0);

	const noop = (): Promise<void> => Promise.resolve();
</script>

<Card name="PlanCard" note="one exercise of a template — closed it is a row, open it is the fields">
	<Frame
		label="tap the row to open it; rest steps inline, faint while inherited, ink once the plan states it"
	>
		<div class="p-3">
			<PlanCard
				meta={bench}
				{exercise}
				{open}
				rest={entryRest(cardEntry.legs, restSettings.current)}
				round={false}
				restShown
				onrest={(seconds) => setEntryRest(cardPlan, cardEntry.id, seconds)}
				ontoggle={() => (open = !open)}
				{onoptions}
				onsets={(count) => setSetCount(cardPlan, exercise.id, count, mint)}
				onreps={(reps) => setExerciseReps(cardPlan, exercise.id, reps)}
				onsetreps={(setId, reps) => setPlannedReps(cardPlan, setId, reps)}
			/>
		</div>
	</Frame>
</Card>

<Card name="PlanRestField" note="a rest a plan states or inherits, stepped where it is read">
	<Spec label="faint while inherited, ink once stated; minus walks into Off, plus back out" full>
		<PlanRestField
			rest={planDefaultRest(planRest, restSettings.current)}
			subject="in this plan"
			onchange={(seconds) => (planRest = seconds)}
		/>
	</Spec>
	<Spec label="dense — the ledger's cell, icon actions for a fine pointer" full>
		<PlanRestField
			dense
			rest={planDefaultRest(planRest, restSettings.current)}
			subject="in this plan"
			onchange={(seconds) => (planRest = seconds)}
		/>
	</Spec>
	<span class={caption}>one slot after the arms: OFF while inherited, DEFAULT once stated</span>
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
				planDefault={undefined}
				onrest={(entryId, seconds) => setEntryRest(template, entryId, seconds)}
				oninsert={() => {}}
				onreorder={(entryId, index) => moveEntry(template, entryId, index)}
			/>
		</div>
	</Frame>
	<span class={caption}>
		one row per exercise — per-set rows only where the targets differ, or where the caret opens
		them; one rest per entry, on the row that closes a superset's round
	</span>
</Card>

<Card name="PlanOffer" note="a session that differed from its plan, on its record and in the plan">
	{#key offerRound}
		<Frame label="on the record, then in the plan's editor, then for a workout with no plan">
			<div class="flex flex-col gap-3 p-3">
				<PlanOffer
					workout={drifted}
					template={offerPlan}
					where="record"
					onupdate={noop}
					ondismiss={noop}
				/>
				<PlanOffer
					workout={drifted}
					template={offerPlan}
					where="plan"
					onupdate={noop}
					ondismiss={noop}
				/>
				<PlanOffer
					workout={drifted}
					template={null}
					where="record"
					onsave={noop}
					ondismiss={noop}
				/>
			</div>
		</Frame>
	{/key}
	<button type="button" class={caption} onclick={() => (offerRound += 1)}>bring them back</button>
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
