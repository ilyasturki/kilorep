<script lang="ts">
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';
	import { goto } from '$app/navigation';

	import { catalogById } from '$lib/catalog';
	import type { Exercise } from '$lib/domain/exercise';
	import { gripLabel } from '$lib/domain/grip';
	import { driftFrom, hasDrift, hasSetDrift } from '$lib/domain/drift';
	import type { SetDrift } from '$lib/domain/drift';
	import { isArchived, startable } from '$lib/domain/template';
	import type { Template } from '$lib/domain/template';
	import {
		addExercise,
		addSet,
		cursorFor,
		draftSet,
		markSet,
		moveEntry,
		rateSet,
		removeExercise,
		removeSet,
		replaceExercise,
		setExerciseGrip,
		setSetArms,
		setSetGrip
	} from '$lib/domain/workout';
	import type { Arms } from '$lib/domain/workout';
	import { workoutTitle } from '$lib/history/label';
	import { launchRepeat, repeatBlocked } from '$lib/history/repeat';
	import WorkoutOptionsMenu from '$lib/history/WorkoutOptionsMenu.svelte';
	import WorkoutSection from '$lib/history/WorkoutSection.svelte';
	import PlanPickerSheet from '$lib/templates/PlanPickerSheet.svelte';
	import { fillAppBar } from '$lib/nav/bar.svelte';
	import { pageSlide } from '$lib/nav/transitions';
	import { syncSoon } from '$lib/sync/client';
	import { entriesWithMeta, legOf } from '$lib/workout/groups';
	import EntryStack from '$lib/workout/EntryStack.svelte';
	import ExerciseOptionsMenu from '$lib/workout/ExerciseOptionsMenu.svelte';
	import ExercisePickerSheet from '$lib/workout/ExercisePickerSheet.svelte';
	import AddRow from '$lib/ui/AddRow.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import { DragOrder, SETTLE } from '$lib/ui/dragOrder.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import { registerOverlay } from '$lib/ui/overlays';
	import SetOptionsMenu from '$lib/workout/SetOptionsMenu.svelte';
	import ClockCounterClockwise from '$lib/ui/icons/ClockCounterClockwise.svelte';
	import DotsSixVertical from '$lib/ui/icons/DotsSixVertical.svelte';
	import More from '$lib/ui/icons/More.svelte';
	import StackPlus from '$lib/ui/icons/StackPlus.svelte';
	import { press } from '$lib/ui/press';

	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	const workout = $state(data.workout);

	// Derived from the workout rather than handed down by the load: linking it to a plan is a
	// write to `templateId`, and the title, the drift and the sheet's own mark read it back.
	// `??`, not `=== null`: records written before `templateId` existed lack the key.
	const template = $derived(
		data.templates.find((candidate) => candidate.id === (workout.templateId ?? null)) ?? null
	);

	// Archived plans last rather than absent: a session imported from a retired plan is
	// exactly the one that needs naming.
	const plans = $derived([...startable(data.templates), ...data.templates.filter(isArchived)]);

	const title = $derived(workoutTitle(workout, template === null ? [] : [template]));
	const drift = $derived(
		template === null ? null : driftFrom(workout, template, (id) => catalogById[id])
	);

	const entries = $derived(entriesWithMeta(workout, catalogById));

	let mounted = false;

	$effect(() => {
		// Read before the gate, so every leaf is tracked on every run.
		const snapshot = $state.snapshot(workout);

		if (!mounted) {
			mounted = true;

			return;
		}

		void data.store.updateWorkout(snapshot, Date.now());

		if (data.user) {
			syncSoon(data.user.id);
		}
	});

	// Not `insertedSetCount`: that reads today's hints, which for an old session
	// would be later lifting shaping an earlier record.
	const ADDED_SETS = 3;

	const ids = () => Array.from({ length: ADDED_SETS }, () => crypto.randomUUID());

	let editing = $state(false);

	let openSetId = $state<string | null>(null);

	function startEditing() {
		pageSlide('push', () => (editing = true));
	}

	function stopEditing() {
		pageSlide('pop', () => {
			editing = false;
			openSetId = null;
		});
	}

	$effect(() => {
		if (!editing) {
			return;
		}

		return registerOverlay(stopEditing);
	});

	function draft(setId: string, weight: number | null, reps: number | null) {
		draftSet(workout, setId, { weight, reps });
	}

	function rate(setId: string, rpe: number | null) {
		rateSet(workout, setId, rpe);
	}

	function toggle(setId: string) {
		const cursor = cursorFor(workout, setId);

		if (cursor === null) {
			return;
		}

		if (!markSet(workout, setId, !cursor.set.completed)) {
			openSetId = setId;
		}
	}

	function add(exerciseId: string) {
		const set = addSet(workout, exerciseId, crypto.randomUUID());

		if (set !== null) {
			openSetId = set.id;
		}
	}

	function insert(exerciseIds: string[]) {
		let opened = false;

		for (const exerciseId of exerciseIds) {
			const entry = addExercise(workout, exerciseId, {
				entry: crypto.randomUUID(),
				exercise: crypto.randomUUID(),
				sets: ids()
			});

			if (entry !== null && !opened) {
				openSetId = entry.exercises[0].sets[0].id;
				opened = true;
			}
		}
	}

	let insertOpen = $state(false);

	let exerciseOpen = $state(false);
	let swapOpen = $state(false);
	let acting = $state<string | null>(null);

	const actingLeg = $derived(legOf(entries, acting));

	let exerciseAnchor = $state<HTMLElement | null>(null);

	function exerciseOptions(exerciseId: string, anchor: HTMLElement) {
		acting = exerciseId;
		exerciseAnchor = anchor;
		exerciseOpen = true;
	}

	function swap(catalogId: string) {
		if (acting === null) {
			return;
		}

		const exercise = replaceExercise(workout, acting, catalogId, {
			exercise: crypto.randomUUID(),
			sets: ids()
		});

		acting = null;

		openSetId = exercise === null ? null : exercise.sets[0].id;
	}

	function gripExercise(grip: string) {
		if (actingLeg !== null) {
			setExerciseGrip(workout, actingLeg.id, actingLeg.meta, grip);
		}

		acting = null;
	}

	function dropExercise() {
		if (acting === null) {
			return;
		}

		removeExercise(workout, acting);
		acting = null;
		openSetId = null;
	}

	let optionsOpen = $state(false);
	let optionsSetId = $state<string | null>(null);
	let optionsAnchor = $state<HTMLElement | null>(null);

	const optionsGroup = $derived(
		entries
			.flatMap((entry) => entry.legs)
			.find((leg) => leg.cursors.some((c) => c.set.id === optionsSetId)) ?? null
	);

	const optionsCursor = $derived(
		optionsGroup === null
			? null
			: (optionsGroup.cursors.find((c) => c.set.id === optionsSetId) ?? null)
	);

	function setOptions(setId: string, anchor: HTMLElement) {
		optionsSetId = setId;
		optionsAnchor = anchor;
		optionsOpen = true;
	}

	function gripSet(grip: string) {
		if (optionsSetId !== null && optionsGroup !== null) {
			setSetGrip(workout, optionsSetId, optionsGroup.meta, grip);
		}
	}

	function armSet(arms: Arms) {
		if (optionsSetId !== null) {
			setSetArms(workout, optionsSetId, arms);
		}
	}

	function dropSet() {
		if (optionsSetId === null) {
			return;
		}

		removeSet(workout, optionsSetId);

		if (openSetId === optionsSetId) {
			openSetId = null;
		}

		optionsSetId = null;
	}

	const entryIds = $derived(entries.map((entry) => entry.id));

	const drag = new DragOrder({
		order: () => entryIds,
		move: (id, index) => moveEntry(workout, id, index)
	});

	const slide = $derived(prefersReducedMotion.current ? 0 : 200);

	const when = new Intl.DateTimeFormat('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});

	function driftMarks(setDrift: SetDrift, meta: Exercise | undefined): string[] {
		const marks: string[] = [];

		if (setDrift.grip !== null) {
			marks.push(gripLabel(meta, setDrift.grip) ?? setDrift.grip);
		}

		if (setDrift.added > 0) {
			marks.push(setDrift.added === 1 ? '+1 set' : `+${setDrift.added} sets`);
		}

		if (setDrift.removed > 0) {
			marks.push(setDrift.removed === 1 ? '−1 set' : `−${setDrift.removed} sets`);
		}

		if (setDrift.retargeted > 0) {
			marks.push('target moved');
		}

		return marks;
	}

	function badgesFor(exerciseNodeId: string, meta: Exercise | undefined): string[] {
		if (drift === null) {
			return [];
		}

		const setDrift = drift.matched[exerciseNodeId];

		if (setDrift === undefined) {
			return ['Unplanned'];
		}

		return hasSetDrift(setDrift) ? driftMarks(setDrift, meta) : [];
	}

	let menuOpen = $state(false);
	let menuAnchor = $state<HTMLElement | null>(null);

	let linkOpen = $state(false);

	function link(picked: Template) {
		workout.templateId = picked.id;
	}

	function unlink() {
		workout.templateId = null;
	}

	let deleteOpen = $state(false);

	async function deleteWorkout() {
		await data.store.deleteWorkout(workout.id, Date.now());

		if (data.user) {
			syncSoon(data.user.id);
		}

		await goto('/history');
	}

	async function launch() {
		await launchRepeat(data.store, workout);
	}

	let discardOpen = $state(false);

	async function repeat() {
		if (await repeatBlocked(data.store)) {
			discardOpen = true;

			return;
		}

		await launch();
	}

	fillAppBar(() => ({ title, action: actions }));
</script>

{#snippet actions()}
	{#if editing}
		<Button variant="chrome" caps onclick={stopEditing}>DONE</Button>
	{:else}
		<div class="flex items-center gap-2">
			<Button variant="chrome" caps onclick={() => void repeat()}>REPEAT</Button>

			<button
				type="button"
				aria-label="Workout options"
				onclick={(e) => {
					menuAnchor = e.currentTarget;
					menuOpen = true;
				}}
				class="grid min-h-chrome w-11 shrink-0 place-items-center rounded-full
					text-ink-muted focus-ring hover:bg-hover press:bg-surface-2"
				{@attach press()}
			>
				<More size={20} />
			</button>
		</div>
	{/if}
{/snippet}

<svelte:head>
	<title>{title} | Kilorep</title>
</svelte:head>

<svelte:window onkeydown={(e) => e.key === 'Escape' && drag.cancel()} />

{#snippet handle(entryId: string)}
	<span
		role="presentation"
		aria-hidden="true"
		onpointerdown={(event) => drag.handleDown(event, entryId)}
		onpointermove={(event) => drag.move(event)}
		onpointerup={(event) => drag.up(event)}
		onpointercancel={(event) => drag.up(event)}
		class="grid size-11 shrink-0 cursor-grab touch-none place-items-center
			text-ink-faint select-none"
	>
		<DotsSixVertical size={18} />
	</span>
{/snippet}

<main class={['column-content flex min-h-full flex-col gap-5 px-3 pt-3', editing && 'pb-4']}>
	<p class="px-1 text-md font-bold text-ink-faint">
		{when.format(workout.startedAt)}
		{#if drift !== null && !hasDrift(drift)}· as planned{/if}
	</p>

	<div class="flex flex-1 flex-col gap-3">
		<div bind:this={drag.root} class="flex flex-col gap-3">
			{#each entries as entry (entry.id)}
				{@const lifted = drag.isLifted(entry.id)}
				{@const settling = drag.settlingId === entry.id}

				<div
					data-drag-id={entry.id}
					animate:flip={{ duration: slide }}
					class={lifted ? 'relative z-10 rounded-2xl bg-sunken' : ''}
				>
					<div
						style:transform={lifted ? `translateY(${drag.offset}px) scale(1.01)` : null}
						style:transition={settling && !prefersReducedMotion.current ? SETTLE : null}
						class={['relative flex flex-col gap-2 rounded-2xl', lifted && 'shadow-lg']}
					>
						<EntryStack legs={entry.legs} superset={entry.superset}>
							{#snippet leg(leg, at)}
								<WorkoutSection
									meta={leg.meta}
									setup={leg.grip}
									entryId={entry.id}
									cursors={leg.cursors}
									badges={badgesFor(leg.id, leg.meta)}
									{editing}
									{openSetId}
									onopen={(setId) => (openSetId = setId)}
									onclose={() => (openSetId = null)}
									ondraft={draft}
									onrate={rate}
									ontoggle={toggle}
									onoptions={setOptions}
									onexercise={(anchor) => exerciseOptions(leg.id, anchor)}
									onadd={() => add(leg.cursors[0].exercise.id)}
									grip={editing && at === 0 ? handle : undefined}
								/>
							{/snippet}
						</EntryStack>
					</div>
				</div>
			{/each}
		</div>

		{#if editing}
			<AddRow label="Add exercise" icon={StackPlus} onclick={() => (insertOpen = true)} />
		{:else if entries.length === 0}
			<div class="flex flex-1 flex-col justify-center">
				<EmptyState title="Nothing in this workout" description="Every exercise has been removed.">
					{#snippet icon()}
						<ClockCounterClockwise size={24} />
					{/snippet}
				</EmptyState>
			</div>
		{/if}

		{#if drift !== null && drift.missing.length > 0}
			<section class="flex flex-col gap-1 rounded-2xl border border-dashed border-line p-3">
				<h2 class="px-1 label-caps text-ink-faint">Planned, not done</h2>
				{#each drift.missing as exerciseId, slot (slot)}
					<p class="px-1 text-md font-bold text-ink-muted">
						{catalogById[exerciseId]?.name ?? exerciseId}
					</p>
				{/each}
			</section>
		{/if}
	</div>

	{#if !editing}
		<div class="sticky bottom-0 -mx-3 mt-auto border-t border-line-soft bg-canvas px-3 py-3">
			<Button variant="commit" class="w-full" onclick={() => void repeat()}>
				Repeat this workout
			</Button>
		</div>
	{/if}
</main>

<ExercisePickerSheet
	bind:open={insertOpen}
	title="Add exercise"
	multiple
	frequent={data.frequent}
	lastPerformed={data.lastPerformed}
	onpick={insert}
/>

<ExercisePickerSheet
	bind:open={swapOpen}
	title="Swap exercise"
	replacing={actingLeg === null ? null : actingLeg.meta}
	lastPerformed={data.lastPerformed}
	onpick={([id]) => swap(id)}
/>

<ExerciseOptionsMenu
	bind:open={exerciseOpen}
	group={actingLeg}
	anchor={exerciseAnchor}
	onswap={() => (swapOpen = true)}
	onremove={dropExercise}
	ongrip={editing ? gripExercise : undefined}
/>

<WorkoutOptionsMenu
	bind:open={menuOpen}
	{title}
	anchor={menuAnchor}
	linked={template !== null}
	onedit={startEditing}
	onlink={() => (linkOpen = true)}
	ondelete={() => (deleteOpen = true)}
/>

<PlanPickerSheet
	bind:open={linkOpen}
	title={template === null ? 'Link to a plan' : 'Change plan'}
	templates={plans}
	currentId={template === null ? null : template.id}
	onpick={link}
	onclear={template === null ? undefined : unlink}
/>

<SetOptionsMenu
	bind:open={optionsOpen}
	cursor={optionsCursor}
	meta={optionsGroup?.meta}
	anchor={optionsAnchor}
	removable={optionsGroup !== null && optionsGroup.cursors.length > 1}
	onremove={dropSet}
	ongrip={editing ? gripSet : undefined}
	onarms={editing ? armSet : undefined}
/>

<AlertDialog
	bind:open={deleteOpen}
	title="Delete this workout?"
	description="Its sets leave history, hints and records for good, on every device."
	confirmLabel="Delete"
	onconfirm={() => void deleteWorkout()}
/>

<AlertDialog
	bind:open={discardOpen}
	title="A workout is in progress"
	description="Repeating this workout discards it, logged sets and all. Finish it from the Workout tab to keep it."
	confirmLabel="Discard and start"
	onconfirm={() => void launch()}
/>
