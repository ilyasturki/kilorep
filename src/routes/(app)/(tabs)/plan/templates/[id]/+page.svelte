<script lang="ts">
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';
	import { goto, invalidate } from '$app/navigation';

	import { catalogById } from '$lib/catalog';
	import {
		addExercise,
		drawableMark,
		isArchived,
		isBlank,
		moveEntry,
		moveExercise,
		PLANNED_SET_COUNT,
		removeExercise,
		replaceExercise,
		setExerciseGrip,
		setExerciseReps,
		setExerciseRest,
		setPlannedReps,
		setSetCount,
		splitEntry,
		startFrom,
		supersetWith
	} from '$lib/domain/template';
	import { firstUncompleted } from '$lib/domain/workout';
	import { fillAppBar } from '$lib/nav/bar.svelte';
	import { syncSoon } from '$lib/sync/client';
	import MarkPickerSheet from '$lib/templates/MarkPickerSheet.svelte';
	import { plannedEntries, planMeta } from '$lib/templates/plan';
	import PlanCard from '$lib/templates/PlanCard.svelte';
	import PlanLedger from '$lib/templates/PlanLedger.svelte';
	import PlanOptionsMenu from '$lib/templates/PlanOptionsMenu.svelte';
	import PlanRestSheet from '$lib/templates/PlanRestSheet.svelte';
	import TemplateMark from '$lib/templates/TemplateMark.svelte';
	import { activeWorkout, SESSION_DEP } from '$lib/workout/active.svelte';
	import EntryStack from '$lib/workout/EntryStack.svelte';
	import ExercisePickerSheet from '$lib/workout/ExercisePickerSheet.svelte';
	import { entryOf, legOf, shelfOf } from '$lib/workout/groups';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import { DragOrder, SETTLE } from '$lib/ui/dragOrder.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import TipButton from '$lib/ui/TipButton.svelte';
	import { deskViewport } from '$lib/ui/viewport';
	import Archive from '$lib/ui/icons/Archive.svelte';
	import ArrowCounterClockwise from '$lib/ui/icons/ArrowCounterClockwise.svelte';
	import ClockCounterClockwise from '$lib/ui/icons/ClockCounterClockwise.svelte';
	import DotsSixVertical from '$lib/ui/icons/DotsSixVertical.svelte';
	import Plus from '$lib/ui/icons/Plus.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	const template = $state(data.template);

	// svelte-ignore state_referenced_locally
	let persisted = $state(data.persisted);

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

	const entries = $derived(plannedEntries(template, catalogById));

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

	function plan(exerciseIds: string[]) {
		let after = insertAfter;

		for (const exerciseId of exerciseIds) {
			const entry = addExercise(template, exerciseId, {
				entry: crypto.randomUUID(),
				exercise: crypto.randomUUID(),
				sets: setIds()
			});

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
	let restOpen = $state(false);
	let acting = $state<string | null>(null);

	const actingGroup = $derived(legOf(entries, acting));
	const actingEntry = $derived(entryOf(entries, acting));

	function options(exerciseId: string, anchor: HTMLElement) {
		acting = exerciseId;
		optionsAnchor = anchor;
		optionsOpen = true;
	}

	// `acting` is not cleared after a swap: the picker's `replacing` still reads it.
	function swapPick(exerciseId: string) {
		if (acting !== null) {
			replaceExercise(template, acting, exerciseId);
		}
	}

	function gripPick(grip: string) {
		if (actingGroup !== null) {
			setExerciseGrip(template, actingGroup.id, actingGroup.meta, grip);
		}
	}

	function restPick(seconds: number | null | undefined) {
		if (acting !== null) {
			setExerciseRest(template, acting, seconds);
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

	function supersetPicks(exerciseIds: string[]) {
		if (actingEntry === null) {
			return;
		}

		for (const exerciseId of exerciseIds) {
			supersetWith(template, actingEntry.id, exerciseId, {
				exercise: crypto.randomUUID(),
				sets: setIds()
			});
		}

		acting = null;
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

		await goto('/plan/templates');
	}

	async function launch() {
		activeWorkout.finish();

		const workout = startFrom($state.snapshot(template), Date.now(), () => crypto.randomUUID());
		const first = firstUncompleted(workout);

		await data.store.saveSnapshot({
			workout,
			activeSetId: first === null ? null : first.set.id,
			rest: null,
			muted: false
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

	// One card at a time on the phone: the collapsed rows are what makes the whole plan fit a
	// screen, and two open at once puts the second one's fields off the bottom again.
	let openLegId = $state<string | null>(null);

	fillAppBar(() => ({ title, action: deskActions }));
</script>

{#snippet trash(size: number)}
	<TipButton
		label="Delete template"
		onclick={() => (deleteOpen = true)}
		class="{CHROME_BUTTON} text-danger"
	>
		<Trash {size} />
	</TipButton>
{/snippet}

{#snippet history(size: number)}
	<TipButton
		label="Sessions from this template"
		onclick={() => void goto(`/plan/templates/${template.id}/history`)}
		class="{CHROME_BUTTON} text-ink-muted"
	>
		<ClockCounterClockwise {size} />
	</TipButton>
{/snippet}

{#snippet archive(size: number)}
	{@const Glyph = archived ? ArrowCounterClockwise : Archive}

	<TipButton
		label={archived ? 'Unarchive template' : 'Archive template'}
		onclick={toggleArchived}
		class="{CHROME_BUTTON} text-ink-muted"
	>
		<Glyph {size} />
	</TipButton>
{/snippet}

{#snippet go()}
	<Button variant="chrome" caps onclick={() => void start()}>START</Button>
{/snippet}

{#snippet deskActions()}
	<div class="hidden items-center gap-2 lg:flex">
		{#if persisted}
			{@render history(20)}
			{@render archive(20)}
			{@render trash(20)}
		{/if}

		{@render go()}
	</div>
{/snippet}

{#snippet identity(meta: boolean)}
	<div class="flex items-center gap-2">
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

{#snippet nothing()}
	<EmptyState title="Nothing planned" description="Add an exercise to shape the session.">
		{#snippet icon()}
			<Stack size={24} />
		{/snippet}
		{#snippet action()}
			<Button onclick={() => openInsert()}>Add exercise</Button>
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

				{#if entries.length === 0}
					{@render nothing()}
				{:else}
					<PlanLedger
						{entries}
						onoptions={options}
						onsets={(id, count) => setSetCount(template, id, count, () => crypto.randomUUID())}
						onreps={(id, reps) => setExerciseReps(template, id, reps)}
						onsetreps={(setId, reps) => setPlannedReps(template, setId, reps)}
						onrest={(id, seconds) => setExerciseRest(template, id, seconds)}
						oninsert={openInsert}
						onreorder={(entryId, index) => moveEntry(template, entryId, index)}
					/>

					<Button variant="raised" class="w-full" onclick={() => openInsert()}
						>+ Add exercise</Button
					>
				{/if}

				{@render startWorkout('pb-[max(0.75rem,var(--spacing-safe-b))]')}
			</div>
		{:else}
			<div bind:this={drag.root} class="column-content flex min-h-full flex-col gap-3 px-3 pt-3">
				{@render identity(false)}

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

						<div
							style:transform={lifted ? `translateY(${drag.offset}px) scale(1.01)` : null}
							style:transition={settling && !prefersReducedMotion.current ? SETTLE : null}
							class={['relative flex flex-col gap-2', lifted && 'shadow-lg']}
						>
							<EntryStack
								legs={entry.legs}
								superset={entry.superset}
								onswap={(leg) => moveExercise(template, leg.id, -1)}
								swapLabel={(leg) => `Move ${leg.meta.name} ahead in the superset`}
							>
								{#snippet leg(leg, at)}
									<PlanCard
										meta={leg.meta}
										exercise={leg.exercise}
										open={openLegId === leg.id}
										ontoggle={() => (openLegId = openLegId === leg.id ? null : leg.id)}
										onoptions={(anchor) => options(leg.id, anchor)}
										onsets={(count) =>
											setSetCount(template, leg.id, count, () => crypto.randomUUID())}
										onreps={(reps) => setExerciseReps(template, leg.id, reps)}
										onsetreps={(setId, reps) => setPlannedReps(template, setId, reps)}
										grip={at === 0 ? handle : undefined}
									/>
								{/snippet}
							</EntryStack>
						</div>
					</div>
				{/each}

				{#if entries.length === 0}
					{@render nothing()}
				{:else}
					<Button variant="raised" class="w-full" onclick={() => openInsert()}
						>+ Add exercise</Button
					>
				{/if}

				{#if persisted}
					<div class="flex justify-center gap-2 pt-2 pb-1">
						{@render history(18)}
						{@render archive(18)}
						{@render trash(18)}
					</div>
				{/if}

				{@render startWorkout()}
			</div>
		{/if}
	</main>
</div>

<ExercisePickerSheet
	bind:open={insertOpen}
	title="Add exercise"
	multiple
	frequent={data.frequent}
	lastPerformed={data.lastPerformed}
	onpick={plan}
/>

<ExercisePickerSheet
	bind:open={swapOpen}
	title="Swap exercise"
	replacing={actingGroup === null ? null : actingGroup.meta}
	lastPerformed={data.lastPerformed}
	heaviest={data.heaviest}
	onpick={([id]) => swapPick(id)}
/>

<ExercisePickerSheet
	bind:open={supersetOpen}
	title="Superset {actingGroup === null ? 'exercise' : actingGroup.meta.name} with…"
	multiple
	verb="Superset"
	pinned={supersetShelf}
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
	group={actingGroup}
	superset={actingEntry !== null && actingEntry.superset}
	anchor={optionsAnchor}
	onswap={() => (swapOpen = true)}
	onsuperset={() => (supersetOpen = true)}
	onrest={() => (restOpen = true)}
	onbreak={breakSuperset}
	onremove={removePlanned}
	ongrip={gripPick}
/>

<PlanRestSheet bind:open={restOpen} group={actingGroup} onchange={restPick} />

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
