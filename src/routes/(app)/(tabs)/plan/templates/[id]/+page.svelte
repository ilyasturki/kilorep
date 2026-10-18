<script lang="ts">
	import type { Snippet } from 'svelte';
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';

	import { exerciseCatalog } from '$lib/exercises/catalog.svelte';
	import { applyDrift } from '$lib/domain/drift';
	import {
		addExercise,
		drawableMark,
		isArchived,
		isBlank,
		leaveEntry,
		moveEntry,
		moveExercise,
		PLANNED_SET_COUNT,
		removeExercise,
		replaceExercise,
		setExerciseGrip,
		setEntryRest,
		setExerciseOptional,
		setExerciseReps,
		setPlannedReps,
		setSetCount,
		splitEntry,
		startFrom,
		supersetWith
	} from '$lib/domain/template';
	import { firstUncompleted } from '$lib/domain/workout';
	import type { Pick } from '$lib/exercises/picker';
	import { fillAppBar } from '$lib/nav/bar.svelte';
	import { barIcon } from '$lib/nav/chrome';
	import { addressOf } from '$lib/nav/entries';
	import { leave } from '$lib/nav/go';
	import { restSettings } from '$lib/settings/rest.svelte';
	import { syncSoon } from '$lib/sync/client';
	import MarkPickerSheet from '$lib/templates/MarkPickerSheet.svelte';
	import {
		entryRest,
		plannedEntries,
		planDefaultRest,
		planMeta,
		roundsLabel
	} from '$lib/templates/plan';
	import type { Planned } from '$lib/templates/plan';
	import PlanCard from '$lib/templates/PlanCard.svelte';
	import PlanLedger from '$lib/templates/PlanLedger.svelte';
	import PlanOffer from '$lib/templates/PlanOffer.svelte';
	import PlanOptionsMenu from '$lib/templates/PlanOptionsMenu.svelte';
	import PlanRestField from '$lib/templates/PlanRestField.svelte';
	import TemplateMark from '$lib/templates/TemplateMark.svelte';
	import { activeWorkout, SESSION_DEP } from '$lib/workout/active.svelte';
	import ExercisePickerSheet from '$lib/workout/ExercisePickerSheet.svelte';
	import { entryOf, legLetter, legOf, shelfOf } from '$lib/workout/groups';
	import AddRow from '$lib/ui/AddRow.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import { DragOrder, SETTLE } from '$lib/ui/dragOrder.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import TipButton from '$lib/ui/TipButton.svelte';
	import { deskViewport } from '$lib/ui/viewport';
	import Archive from '$lib/ui/icons/Archive.svelte';
	import ArrowCounterClockwise from '$lib/ui/icons/ArrowCounterClockwise.svelte';
	import ArrowsMerge from '$lib/ui/icons/ArrowsMerge.svelte';
	import ClockCounterClockwise from '$lib/ui/icons/ClockCounterClockwise.svelte';
	import DotsSixVertical from '$lib/ui/icons/DotsSixVertical.svelte';
	import Plus from '$lib/ui/icons/Plus.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';
	import StackPlus from '$lib/ui/icons/StackPlus.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	const template = $state(data.template);

	// svelte-ignore state_referenced_locally
	let persisted = $state(data.persisted);

	// svelte-ignore state_referenced_locally
	let planRest = $state(data.planRest);

	function setPlanRest(seconds: number | null | undefined) {
		planRest = seconds;

		const now = Date.now();

		void (seconds === undefined
			? data.store.clearPlanRest(template.id, now)
			: data.store.setPlanRest(template.id, seconds, now));

		if (data.user) {
			syncSoon(data.user.id);
		}
	}

	let mounted = false;

	$effect(() => {
		// Read before any gate, so every leaf is tracked on every run.
		const snapshot = $state.snapshot(template);

		if (!mounted) {
			mounted = true;
			return;
		}

		if (!persisted && isBlank(snapshot)) {
			return;
		}

		persisted = true;
		void data.store.saveTemplate(snapshot, Date.now());

		if (data.user) {
			syncSoon(data.user.id);
		}
	});

	$effect(() => () => {
		if (persisted && isBlank($state.snapshot(template))) {
			void data.store.deleteTemplate(template.id, Date.now());
		}
	});

	const entries = $derived(plannedEntries(template, exerciseCatalog.current.byId));

	const entryIds = $derived(entries.map((entry) => entry.id));

	let startBar = $state<HTMLElement | null>(null);

	const drag = new DragOrder({
		order: () => entryIds,
		move: (id, index) => {
			moveEntry(template, id, index);

			return true;
		},
		covered: () => startBar?.offsetHeight ?? 0
	});

	const slide = $derived(prefersReducedMotion.current ? 0 : 200);

	let insertOpen = $state(false);

	// Which entry the picker was opened from — the ledger's per-entry footer inserts after
	// the block it hangs off, the way the live session's own footer does. Null adds at the end.
	let insertAfter = $state<string | null>(null);

	const setIds = () => Array.from({ length: PLANNED_SET_COUNT }, () => crypto.randomUUID());

	function plan(picks: Pick[]) {
		let after = insertAfter;

		for (const pick of picks) {
			const entry = addExercise(
				template,
				pick.exerciseId,
				{ entry: crypto.randomUUID(), exercise: crypto.randomUUID(), sets: setIds() },
				pick.grip
			);

			if (entry === null || after === null) {
				continue;
			}

			// Read after the append and before the move: the slot wanted is the one behind the
			// anchor, and each pick becomes the anchor for the next so a multi-pick lands in
			// the order it was picked rather than reversed.
			const anchor = after;
			const at = template.entries.findIndex((existing) => existing.id === anchor);

			if (at !== -1) {
				moveEntry(template, entry.id, at + 1);
				after = entry.id;
			}
		}

		insertAfter = null;
	}

	function openInsert(after: string | null = null) {
		insertAfter = after;
		insertOpen = true;
	}

	let optionsOpen = $state(false);
	let optionsAnchor = $state<HTMLElement | null>(null);
	let swapOpen = $state(false);
	let supersetOpen = $state(false);
	let acting = $state<string | null>(null);

	const actingGroup = $derived(legOf(entries, acting));
	const actingEntry = $derived(entryOf(entries, acting));

	function options(exerciseId: string, anchor: HTMLElement) {
		acting = exerciseId;
		optionsAnchor = anchor;
		optionsOpen = true;
	}

	function swapPick([pick]: Pick[]) {
		if (acting !== null && pick !== undefined) {
			replaceExercise(template, acting, pick.exerciseId, pick.grip);
			acting = null;
		}
	}

	function gripPick(grip: string) {
		if (actingGroup !== null) {
			setExerciseGrip(template, actingGroup.id, actingGroup.meta, grip);
		}
	}

	function removePlanned() {
		if (acting !== null) {
			removeExercise(template, acting);
			acting = null;
		}
	}

	const supersetShelf = $derived(
		actingEntry === null ? null : shelfOf(entries, actingEntry.id, 'In this plan')
	);

	const present = $derived(
		template.entries.flatMap((entry) => entry.exercises.map((e) => e.exerciseId))
	);

	function supersetPicks(picks: Pick[]) {
		if (actingEntry === null) {
			return;
		}

		for (const pick of picks) {
			supersetWith(
				template,
				actingEntry.id,
				pick.exerciseId,
				{ exercise: crypto.randomUUID(), sets: setIds() },
				pick.grip
			);
		}

		acting = null;
	}

	// The picker opened from a superset's own add row: what it picks joins that superset.
	function supersetInto(entryId: string) {
		const entry = entries.find((candidate) => candidate.id === entryId);

		if (entry !== undefined) {
			acting = entry.legs[0].id;
			supersetOpen = true;
		}
	}

	function leaveSuperset() {
		if (acting !== null) {
			leaveEntry(template, acting, () => crypto.randomUUID());
			acting = null;
		}
	}

	const actingLegIndex = $derived(
		actingEntry === null || acting === null
			? -1
			: actingEntry.legs.findIndex((leg) => leg.id === acting)
	);

	function moveLeg(towards: -1 | 1) {
		if (acting !== null) {
			moveExercise(template, acting, towards);
			acting = null;
		}
	}

	function breakSuperset() {
		if (actingEntry !== null) {
			splitEntry(template, actingEntry.id, () => crypto.randomUUID());
			acting = null;
		}
	}

	let deleteOpen = $state(false);

	async function deleteTemplate() {
		await data.store.deleteTemplate(template.id, Date.now());

		if (data.user) {
			syncSoon(data.user.id);
		}

		await leave('/plan/templates');
	}

	async function launch() {
		activeWorkout.finish();

		const workout = startFrom($state.snapshot(template), Date.now(), () => crypto.randomUUID(), {
			planDefault: planRest,
			settings: restSettings.current
		});
		const first = firstUncompleted(workout);

		await data.store.saveSnapshot({
			workout,
			activeSetId: first === null ? null : first.set.id,
			rest: null,
			muted: false,
			dismissed: null
		});

		await invalidate(SESSION_DEP);
		await goto('/train/live');
	}

	let markOpen = $state(false);

	const mark = $derived(drawableMark(template));

	const archived = $derived(isArchived(template));

	const CHROME_BUTTON =
		'grid min-h-chrome w-11 shrink-0 place-items-center rounded-full border border-line ' +
		'focus-ring hover:bg-hover press:bg-surface-2';

	function toggleArchived() {
		template.archivedAt = archived ? null : Date.now();
	}

	let discardOpen = $state(false);

	async function start() {
		if (activeWorkout.session !== null || (await data.store.loadSnapshot()) !== null) {
			discardOpen = true;

			return;
		}

		await launch();
	}

	const title = $derived(template.name.trim() === '' ? 'New template' : template.name);

	// svelte-ignore state_referenced_locally
	const offered = data.offered;

	async function answerOffer() {
		if (offered !== null) {
			await data.store.answerOffer(template.id, offered.id, Date.now());

			if (data.user) {
				syncSoon(data.user.id);
			}
		}
	}

	async function updateFromOffer(swaps: string[]) {
		if (offered === null) {
			return;
		}

		applyDrift(
			template,
			offered,
			(id) => exerciseCatalog.current.byId[id],
			() => crypto.randomUUID(),
			swaps
		);

		await answerOffer();
	}

	// One card at a time on the phone: the collapsed rows are what makes the whole plan fit a
	// screen, and two open at once puts the second one's fields off the bottom again.
	let openLegId = $state<string | null>(null);

	const here = $derived(addressOf(page.url));

	let nameInView = $state(true);

	function watchName(node: HTMLElement) {
		const observer = new IntersectionObserver(([entry]) => {
			nameInView = entry.isIntersecting;
		});

		observer.observe(node);

		return () => observer.disconnect();
	}

	fillAppBar(() => ({ title: nameInView ? null : title, action: deskActions }));
</script>

{#snippet trash(size: number, look: string)}
	<TipButton label="Delete template" onclick={() => (deleteOpen = true)} class="{look} text-danger">
		<Trash {size} />
	</TipButton>
{/snippet}

{#snippet history(size: number, look: string)}
	<TipButton
		label="Sessions from this template"
		onclick={() => void goto(`/plan/templates/${template.id}/history`)}
		class="{look} text-ink-muted"
	>
		<ClockCounterClockwise {size} />
	</TipButton>
{/snippet}

{#snippet archive(size: number, look: string)}
	{@const Glyph = archived ? ArrowCounterClockwise : Archive}

	<TipButton
		label={archived ? 'Unarchive template' : 'Archive template'}
		onclick={toggleArchived}
		class="{look} text-ink-muted"
	>
		<Glyph {size} />
	</TipButton>
{/snippet}

{#snippet go()}
	<Button variant="bar" caps onclick={() => void start()}>START</Button>
{/snippet}

{#snippet deskActions()}
	<div class="hidden items-center gap-1 lg:flex">
		{#if persisted}
			{@render history(20, barIcon)}
			{@render archive(20, barIcon)}
			{@render trash(20, barIcon)}
		{/if}

		{@render go()}
	</div>
{/snippet}

{#snippet identity(meta: boolean)}
	<div class="flex items-center gap-2" {@attach watchName}>
		<TipButton
			label={mark === null ? 'Pick a template icon' : 'Change the template icon'}
			onclick={() => (markOpen = true)}
			class="grid size-11 shrink-0 place-items-center rounded-xl focus-ring
				hover:bg-hover press:bg-surface-2"
		>
			{#if mark === null}
				<span
					aria-hidden="true"
					class="grid size-8 place-items-center rounded-lg border border-dashed
						border-line text-ink-faint"
				>
					<Plus size={16} />
				</span>
			{:else}
				<TemplateMark {mark} />
			{/if}
		</TipButton>

		<input
			bind:value={template.name}
			aria-label="Template name"
			placeholder="Push day"
			autocomplete="off"
			class="min-w-0 flex-1 rounded-lg bg-transparent px-1 text-2xl font-extrabold
				tracking-tight text-ink focus-ring placeholder:text-ink-faint"
		/>

		{#if meta && entries.length > 0}
			<span class="shrink-0 text-sm font-bold text-ink-faint">{planMeta(template)}</span>
		{/if}
	</div>
{/snippet}

{#snippet planRestRow()}
	{#if restSettings.current.enabled}
		<div class="flex items-center gap-2 pl-1">
			<span class="min-w-0 flex-1">
				<span class="block truncate label-caps">Plan rest</span>
				<span class="block truncate text-sm font-bold text-ink-faint">
					{planRest === undefined ? 'From Settings' : 'Whole plan'}
				</span>
			</span>

			<PlanRestField
				rest={planDefaultRest(planRest, restSettings.current)}
				subject="in this plan"
				onchange={setPlanRest}
			/>
		</div>
	{/if}
{/snippet}

{#snippet offer()}
	{#if offered !== null && !archived}
		<PlanOffer
			workout={offered}
			{template}
			where="plan"
			onupdate={updateFromOffer}
			ondismiss={answerOffer}
		/>
	{/if}
{/snippet}

{#snippet nothing()}
	<EmptyState title="Nothing planned" description="Add an exercise to shape the session.">
		{#snippet icon()}
			<Stack size={24} />
		{/snippet}
		{#snippet action()}
			<Button onclick={() => openInsert()}>
				<StackPlus size={20} />
				Add exercise
			</Button>
		{/snippet}
	</EmptyState>
{/snippet}

{#snippet startWorkout(klass?: string)}
	<div
		bind:this={startBar}
		class={['sticky bottom-0 -mx-3 mt-auto border-t border-line-soft bg-canvas px-3 py-3', klass]}
	>
		<Button variant="commit" class="w-full" onclick={() => void start()}>Start workout</Button>
	</div>
{/snippet}

<svelte:head>
	<title>{title} | Kilorep</title>
</svelte:head>

<svelte:window onkeydown={(e) => e.key === 'Escape' && drag.cancel()} />

<div class="flex min-h-0 flex-1 flex-col">
	<main class="min-h-0 flex-1 overflow-y-auto">
		{#if deskViewport.current}
			<div class="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-3 px-3 pt-3">
				{@render identity(true)}
				{@render planRestRow()}

				{@render offer()}

				{#if entries.length === 0}
					{@render nothing()}
				{:else}
					<PlanLedger
						{entries}
						from={here}
						onoptions={options}
						onsets={(id, count) => setSetCount(template, id, count, () => crypto.randomUUID())}
						onreps={(id, reps) => setExerciseReps(template, id, reps)}
						onsetreps={(setId, reps) => setPlannedReps(template, setId, reps)}
						planDefault={planRest}
						onrest={(entryId, seconds) => setEntryRest(template, entryId, seconds)}
						oninsert={openInsert}
						onsuperset={supersetInto}
						onreorder={(entryId, index) => moveEntry(template, entryId, index)}
					/>

					<Button variant="raised" class="w-full" onclick={() => openInsert()}>
						<StackPlus size={20} />
						Add exercise
					</Button>
				{/if}

				{@render startWorkout('pb-[max(0.75rem,var(--spacing-safe-b))]')}
			</div>
		{:else}
			<div bind:this={drag.root} class="column-content flex min-h-full flex-col gap-3 px-3 pt-3">
				{@render identity(false)}
				{@render planRestRow()}

				{@render offer()}

				{#each entries as entry (entry.id)}
					{@const lifted = drag.isLifted(entry.id)}
					{@const settling = drag.settlingId === entry.id}

					<div
						data-drag-id={entry.id}
						animate:flip={{ duration: slide }}
						class={lifted ? 'relative z-10 rounded-2xl bg-sunken' : ''}
					>
						{#snippet handle()}
							<span
								role="presentation"
								aria-hidden="true"
								onpointerdown={(event) => drag.handleDown(event, entry.id)}
								onpointermove={(event) => drag.move(event)}
								onpointerup={(event) => drag.up(event)}
								onpointercancel={(event) => drag.up(event)}
								class="grid size-11 shrink-0 cursor-grab touch-none place-items-center
									text-ink-faint select-none"
							>
								<DotsSixVertical size={18} />
							</span>
						{/snippet}

						{#snippet card(leg: Planned, letter?: string, grip?: Snippet)}
							<PlanCard
								meta={leg.meta}
								from={here}
								exercise={leg.exercise}
								{letter}
								open={openLegId === leg.id}
								rest={restSettings.current.enabled && !entry.superset
									? entryRest(entry.legs, restSettings.current, planRest)
									: null}
								onrest={(seconds) => setEntryRest(template, entry.id, seconds)}
								ontoggle={() => (openLegId = openLegId === leg.id ? null : leg.id)}
								onoptions={(anchor) => options(leg.id, anchor)}
								onsets={(count) => setSetCount(template, leg.id, count, () => crypto.randomUUID())}
								onreps={(reps) => setExerciseReps(template, leg.id, reps)}
								onsetreps={(setId, reps) => setPlannedReps(template, setId, reps)}
								{grip}
							/>
						{/snippet}

						<div
							style:transform={lifted ? `translateY(${drag.offset}px) scale(1.01)` : null}
							style:transition={settling && !prefersReducedMotion.current ? SETTLE : null}
							class={['relative flex flex-col gap-2', lifted && 'shadow-lg']}
						>
							{#if entry.superset}
								<section class="flex flex-col list-group">
									<div class="flex min-h-11 items-center gap-1 pr-1 pl-4">
										<h2 class="flex min-w-0 flex-1 items-baseline gap-2">
											<span class="shrink-0 label-caps text-accent-text">Superset</span>
											<span class="truncate text-sm font-bold text-ink-faint">
												{roundsLabel(entry.legs)}
											</span>
										</h2>

										{@render handle()}
									</div>

									{#each entry.legs as leg, at (leg.id)}
										{@render card(leg, legLetter(at))}
									{/each}

									{#if restSettings.current.enabled}
										<div class="flex items-center gap-2 py-2 pr-3 pl-4">
											<span class="min-w-0 flex-1 truncate label-caps">Rest per round</span>

											<PlanRestField
												rest={entryRest(entry.legs, restSettings.current, planRest)}
												subject="after each round of {entry.title}"
												onchange={(seconds) => setEntryRest(template, entry.id, seconds)}
											/>
										</div>
									{/if}

									<AddRow
										flush
										label="Add to superset"
										icon={ArrowsMerge}
										onclick={() => supersetInto(entry.id)}
									/>
								</section>
							{:else}
								{@render card(entry.legs[0], undefined, handle)}
							{/if}
						</div>
					</div>
				{/each}

				{#if entries.length === 0}
					{@render nothing()}
				{:else}
					<Button variant="raised" class="w-full" onclick={() => openInsert()}>
						<StackPlus size={20} />
						Add exercise
					</Button>
				{/if}

				{#if persisted}
					<div class="flex justify-center gap-2 pt-2 pb-1">
						{@render history(18, CHROME_BUTTON)}
						{@render archive(18, CHROME_BUTTON)}
						{@render trash(18, CHROME_BUTTON)}
					</div>
				{/if}

				{@render startWorkout()}
			</div>
		{/if}
	</main>
</div>

<ExercisePickerSheet
	bind:open={insertOpen}
	account={data.user?.id ?? null}
	title="Add exercise"
	multiple
	frequent={data.frequent}
	{present}
	presentLabel="In plan"
	lastPerformed={data.lastPerformed}
	onpick={plan}
/>

<ExercisePickerSheet
	bind:open={swapOpen}
	account={data.user?.id ?? null}
	title="Swap exercise"
	replacing={actingGroup === null ? null : actingGroup.meta}
	{present}
	presentLabel="In plan"
	lastPerformed={data.lastPerformed}
	heaviest={data.heaviest}
	onpick={swapPick}
/>

<ExercisePickerSheet
	bind:open={supersetOpen}
	account={data.user?.id ?? null}
	title={actingEntry !== null && actingEntry.superset
		? 'Add to superset'
		: `Superset ${actingGroup === null ? 'exercise' : actingGroup.meta.name} with…`}
	multiple
	verb={actingEntry !== null && actingEntry.superset ? 'Add' : 'Superset'}
	pinned={supersetShelf}
	{present}
	presentLabel="In plan"
	lastPerformed={data.lastPerformed}
	onpick={supersetPicks}
/>

<MarkPickerSheet
	bind:open={markOpen}
	{mark}
	onpick={(picked) => {
		template.mark = picked;
	}}
/>

<PlanOptionsMenu
	bind:open={optionsOpen}
	from={here}
	group={actingGroup}
	superset={actingEntry !== null && actingEntry.superset}
	anchor={optionsAnchor}
	onswap={() => (swapOpen = true)}
	onsuperset={() => (supersetOpen = true)}
	onbreak={actingEntry !== null && actingEntry.legs.length > 2 ? breakSuperset : undefined}
	onleave={leaveSuperset}
	onahead={actingLegIndex > 0 ? () => moveLeg(-1) : undefined}
	onbehind={actingEntry !== null &&
	actingLegIndex >= 0 &&
	actingLegIndex < actingEntry.legs.length - 1
		? () => moveLeg(1)
		: undefined}
	onremove={removePlanned}
	ongrip={gripPick}
	onoptional={(optional) => {
		if (acting !== null) {
			setExerciseOptional(template, acting, optional);
		}
	}}
/>

<AlertDialog
	bind:open={deleteOpen}
	title="Delete this template?"
	description="The plan is gone for good. Workouts already logged from it keep their records."
	confirmLabel="Delete"
	onconfirm={() => void deleteTemplate()}
/>

<AlertDialog
	bind:open={discardOpen}
	title="A workout is in progress"
	description="Starting this template discards it, logged sets and all. Finish it from the Workout tab to keep it."
	confirmLabel="Discard and start"
	onconfirm={() => void launch()}
/>
