<script lang="ts">
	import { tick } from 'svelte';
	import { flip } from 'svelte/animate';
	import { goto } from '$app/navigation';

	import { catalogById } from '$lib/catalog';
	import type { Exercise } from '$lib/domain/exercise';
	import { gripLabel } from '$lib/domain/grip';
	import { driftFrom, hasDrift, hasSetDrift } from '$lib/domain/drift';
	import type { SetDrift } from '$lib/domain/drift';
	import { isArchived, startable } from '$lib/domain/template';
	import type { Template } from '$lib/domain/template';
	import { canCommit, firstUncompleted, prefillFor } from '$lib/domain/workout';
	import type { Arms, History } from '$lib/domain/workout';
	import { workoutTitle } from '$lib/history/label';
	import { launchRepeat, repeatBlocked } from '$lib/history/repeat';
	import RecordLedger from '$lib/history/RecordLedger.svelte';
	import WorkoutOptionsMenu from '$lib/history/WorkoutOptionsMenu.svelte';
	import PlanPickerSheet from '$lib/templates/PlanPickerSheet.svelte';
	import { fillAppBar } from '$lib/nav/bar.svelte';
	import { bottomDock } from '$lib/nav/dock.svelte';
	import { pageSlide } from '$lib/nav/transitions';
	import { exertionScale } from '$lib/settings/exertion.svelte';
	import { syncSoon } from '$lib/sync/client';
	import { entriesWithMeta, entryOf, legOf, setNote, shelfOf } from '$lib/workout/groups';
	import { WorkoutSession } from '$lib/workout/session.svelte';
	import EntryStack from '$lib/workout/EntryStack.svelte';
	import ExerciseBlock from '$lib/workout/ExerciseBlock.svelte';
	import ExerciseOptionsMenu from '$lib/workout/ExerciseOptionsMenu.svelte';
	import ExercisePickerSheet from '$lib/workout/ExercisePickerSheet.svelte';
	import ExertionDialog from '$lib/workout/ExertionDialog.svelte';
	import LiveLedger from '$lib/workout/LiveLedger.svelte';
	import LiveTray from '$lib/workout/LiveTray.svelte';
	import SetOptionsMenu from '$lib/workout/SetOptionsMenu.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import { smallMs } from '$lib/ui/motion';
	import { registerOverlay } from '$lib/ui/overlays';
	import { revealNearest } from '$lib/ui/scroll';
	import { deskViewport } from '$lib/ui/viewport';
	import ClockCounterClockwise from '$lib/ui/icons/ClockCounterClockwise.svelte';
	import More from '$lib/ui/icons/More.svelte';
	import Pencil from '$lib/ui/icons/Pencil.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';
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

	// The record predates today's lifting, so nothing here may read it: no last-time hints, no
	// prefilled offers shaped by later sessions — the numbers on screen are the record's own.
	const NO_HISTORY: History = {};

	// Editing IS a session: the same holder the live screen drives, resumed over this record's
	// own state proxy, so every mutation lands in the workout the page already persists.
	// Read through the derived alias — a plain `let` never narrows inside the template.
	let held = $state<WorkoutSession | null>(null);

	const session = $derived(held);

	const editing = $derived(session !== null);

	const desk = $derived(deskViewport.current);

	let unlockOpen = $state(false);

	function startEditing() {
		pageSlide('push', () => {
			held = new WorkoutSession(NO_HISTORY, {
				workout,
				activeSetId: firstUncompleted(workout)?.set.id ?? null
			});
		});
	}

	function stopEditing() {
		pageSlide('pop', () => {
			held = null;
		});
	}

	$effect(() => {
		if (!editing) {
			return;
		}

		return registerOverlay(stopEditing);
	});

	$effect(() => {
		bottomDock.claimed = editing;

		return () => {
			bottomDock.claimed = false;
		};
	});

	async function settle() {
		await tick();

		const holder = document.querySelector('[data-active-set]');

		if (holder instanceof HTMLElement) {
			revealNearest(holder);
		}
	}

	$effect(() => {
		if (session === null || session.activeSetId === null) {
			return;
		}

		void settle();
	});

	function jumpTo(setId: string) {
		session?.select(setId);
	}

	const allCursors = $derived(entries.flatMap((entry) => entry.cursors));

	const activeLeg = $derived(
		entries
			.flatMap((entry) => entry.legs)
			.find((leg) => leg.cursors.some((c) => c.set.id === session?.activeSetId)) ?? null
	);

	const activeCursor = $derived(
		activeLeg?.cursors.find((c) => c.set.id === session?.activeSetId) ?? null
	);

	const activeCount = $derived(
		activeLeg === null ? 0 : activeLeg.cursors.filter((c) => c.workingIndex >= 0).length
	);

	function logSet(weight: number, reps: number) {
		session?.commit(weight, reps);
	}

	function quickLog(setId: string, weight: number, reps: number) {
		session?.quickLog(setId, weight, reps);
	}

	function draftActive(weight: number | null, reps: number | null) {
		if (session !== null && session.activeSetId !== null) {
			session.draft(session.activeSetId, weight, reps);
		}
	}

	function rateActive(rpe: number | null) {
		if (session !== null && session.activeSetId !== null) {
			session.rate(session.activeSetId, rpe);
		}
	}

	const slide = $derived(smallMs());

	let insertOpen = $state(false);
	let insertAfter = $state<string | null>(null);

	function insertFrom(entryId: string | null) {
		insertAfter = entryId;
		insertOpen = true;
	}

	function insertPicks(exerciseIds: string[]) {
		session?.addExercises(exerciseIds, insertAfter ?? undefined);
		insertAfter = null;
	}

	let exerciseOpen = $state(false);
	let swapOpen = $state(false);
	let supersetOpen = $state(false);
	let acting = $state<string | null>(null);

	const actingLeg = $derived(legOf(entries, acting));
	const actingEntry = $derived(entryOf(entries, acting));

	const actingIndex = $derived(
		actingEntry === null ? -1 : entries.findIndex((entry) => entry.id === actingEntry.id)
	);

	const supersetShelf = $derived(
		actingEntry === null ? null : shelfOf(entries, actingEntry.id, 'In this workout')
	);

	let exerciseAnchor = $state<HTMLElement | null>(null);

	function exerciseOptions(exerciseId: string, anchor: HTMLElement) {
		acting = exerciseId;
		exerciseAnchor = anchor;
		exerciseOpen = true;
	}

	function gripExercise(grip: string) {
		if (session === null || acting === null) {
			return;
		}

		session.setExerciseGrip(acting, grip);
		acting = null;
	}

	function moveActing(to: number) {
		if (session === null || actingEntry === null) {
			return;
		}

		session.moveEntry(actingEntry.id, to);
		acting = null;
	}

	function swapPick(catalogId: string) {
		if (session === null || acting === null) {
			return;
		}

		session.swapExercise(acting, catalogId);
		acting = null;
	}

	function supersetPicks(exerciseIds: string[]) {
		if (session === null || actingEntry === null) {
			return;
		}

		session.superset(actingEntry.id, exerciseIds);
		acting = null;
	}

	function breakSuperset() {
		if (session === null || actingEntry === null) {
			return;
		}

		session.breakSuperset(actingEntry.id);
		acting = null;
	}

	function removeExercise() {
		if (session === null || acting === null) {
			return;
		}

		session.removeExercise(acting);
		acting = null;
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

	function options(setId: string, anchor: HTMLElement) {
		optionsSetId = setId;
		optionsAnchor = anchor;
		optionsOpen = true;
	}

	function gripSet(grip: string) {
		if (session !== null && optionsSetId !== null) {
			session.setSetGrip(optionsSetId, grip);
		}
	}

	// Desktop only: the phone's tray already carries its own custom entry in the picker.
	let exertionOpen = $state(false);

	function rateSet(rpe: number | null) {
		if (session !== null && optionsSetId !== null) {
			session.rate(optionsSetId, rpe);
		}
	}

	function armSet(arms: Arms) {
		if (session !== null && optionsSetId !== null) {
			session.setSetArms(optionsSetId, arms);
		}
	}

	function unlogSet() {
		if (session === null || optionsSetId === null) {
			return;
		}

		session.unlogSet(optionsSetId);
		optionsSetId = null;
	}

	function clearSet() {
		if (session === null || optionsSetId === null) {
			return;
		}

		session.clear(optionsSetId);
		optionsSetId = null;
	}

	function removeSet() {
		if (session === null || optionsSetId === null) {
			return;
		}

		session.removeSet(optionsSetId);
		optionsSetId = null;
	}

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

	// The ledger has no commit button of its own beyond the row checks, so Enter logs the
	// highlighted set — but only from the page floor: a focused button or an open dialog
	// answers Enter itself, and firing both would log a set behind the lifter's back.
	function deskEnter(event: KeyboardEvent) {
		if (!desk || event.key !== 'Enter' || event.target !== document.body) {
			return;
		}

		if (session === null || activeCursor === null || activeLeg === null) {
			return;
		}

		const offer = prefillFor(activeCursor, NO_HISTORY, activeLeg.meta);

		if (canCommit(offer.weight, offer.reps)) {
			logSet(offer.weight as number, offer.reps as number);
		}
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

<svelte:window onkeydown={deskEnter} />

{#snippet actions()}
	{#if editing}
		<Button variant="chrome" caps onclick={stopEditing}>DONE</Button>
	{:else}
		<div class="flex items-center gap-2">
			<Button variant="chrome" caps onclick={() => void repeat()}>REPEAT</Button>

			<button
				type="button"
				aria-label="Edit this workout"
				onclick={() => (unlockOpen = true)}
				class="grid min-h-chrome w-11 shrink-0 place-items-center rounded-full border
					border-line text-ink-muted focus-ring hover:bg-hover press:bg-surface-2"
				{@attach press()}
			>
				<Pencil size={18} />
			</button>

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

{#if session === null}
	<main class="min-h-0 flex-1 overflow-y-auto">
		<div class="column-content flex min-h-full flex-col gap-5 px-3 pt-3 pb-6">
			<p class="px-1 text-md font-bold text-ink-faint">
				{when.format(workout.startedAt)}
				{#if drift !== null && !hasDrift(drift)}· as planned{/if}
			</p>

			<div class="flex flex-1 flex-col gap-3">
				{#if entries.length === 0}
					<div class="flex flex-1 flex-col justify-center">
						<EmptyState
							title="Nothing in this workout"
							description="Every exercise has been removed."
						>
							{#snippet icon()}
								<ClockCounterClockwise size={24} />
							{/snippet}
						</EmptyState>
					</div>
				{:else}
					{#each entries as entry (entry.id)}
						<div class="relative flex flex-col gap-2 rounded-2xl">
							<EntryStack legs={entry.legs} superset={entry.superset}>
								{#snippet leg(leg)}
									<RecordLedger
										meta={leg.meta}
										grip={leg.grip}
										cursors={leg.cursors}
										badges={badgesFor(leg.id, leg.meta)}
									/>
								{/snippet}
							</EntryStack>
						</div>
					{/each}
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
		</div>
	</main>
{:else}
	<div class="flex min-h-0 flex-1 flex-col">
		<main class="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto py-3 pb-6">
			{#if entries.length === 0}
				<div class="mx-auto flex min-h-full w-full max-w-xl flex-col gap-7 px-3">
					<EmptyState title="Nothing in this workout" description="Add an exercise to log sets.">
						{#snippet icon()}
							<Stack size={24} />
						{/snippet}
						{#snippet action()}
							<Button variant="commit" onclick={() => insertFrom(null)}>Add exercise</Button>
						{/snippet}
					</EmptyState>
				</div>
			{:else if desk}
				<div class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4">
					<LiveLedger
						{entries}
						history={NO_HISTORY}
						activeSetId={session.activeSetId}
						onselect={jumpTo}
						onquick={quickLog}
						oncommit={logSet}
						ondraft={draftActive}
						onrate={rateActive}
						onadd={(exerciseId) => session.addSet(exerciseId)}
						oninsert={insertFrom}
						onoptions={options}
						onexercise={exerciseOptions}
						onreorder={(entryId, index) => session.moveEntry(entryId, index)}
					/>
				</div>
			{:else}
				<div class="mx-auto flex w-full max-w-xl flex-col gap-7 px-3">
					{#each entries as entry (entry.id)}
						<div animate:flip={{ duration: slide }} class="relative flex flex-col gap-5">
							<EntryStack
								legs={entry.legs}
								superset={entry.superset}
								onswap={(leg) => session.moveExercise(leg.id)}
								swapLabel={(leg) => `Move ${leg.meta.name} ahead in the superset`}
							>
								{#snippet leg(leg)}
									<ExerciseBlock
										meta={leg.meta}
										grip={leg.grip}
										cursors={leg.cursors}
										history={NO_HISTORY}
										activeSetId={session.activeSetId}
										onselect={jumpTo}
										onquick={quickLog}
										onadd={() => session.addSet(leg.cursors[0].exercise.id)}
										oninsert={() => insertFrom(entry.id)}
										onoptions={options}
										onexercise={(anchor) => exerciseOptions(leg.id, anchor)}
									/>
								{/snippet}
							</EntryStack>
						</div>
					{/each}
				</div>
			{/if}
		</main>

		{#if !desk && entries.length > 0}
			<LiveTray
				cursor={activeCursor}
				meta={activeLeg?.meta}
				note={activeCursor === null
					? null
					: setNote(activeLeg?.meta, activeLeg?.grip, activeCursor.set)}
				count={activeCount}
				history={NO_HISTORY}
				total={allCursors.length}
				rest={false}
				hints={false}
				finishLabel="DONE"
				oncommit={logSet}
				ondraft={draftActive}
				onrate={rateActive}
				onoptions={(anchor) => {
					if (session.activeSetId !== null) {
						options(session.activeSetId, anchor);
					}
				}}
				onfinish={stopEditing}
			/>
		{/if}
	</div>
{/if}

<ExercisePickerSheet
	bind:open={insertOpen}
	title="Add exercise"
	multiple
	frequent={data.frequent}
	lastPerformed={data.lastPerformed}
	onpick={insertPicks}
/>

<ExercisePickerSheet
	bind:open={swapOpen}
	title="Swap exercise"
	replacing={actingLeg === null ? null : actingLeg.meta}
	lastPerformed={data.lastPerformed}
	heaviest={data.heaviest}
	onpick={([id]) => swapPick(id)}
/>

<ExercisePickerSheet
	bind:open={supersetOpen}
	title="Superset {actingLeg === null ? 'exercise' : actingLeg.meta.name} with…"
	multiple
	verb="Superset"
	pinned={supersetShelf}
	lastPerformed={data.lastPerformed}
	onpick={supersetPicks}
/>

<ExerciseOptionsMenu
	bind:open={exerciseOpen}
	group={actingLeg}
	superset={actingEntry !== null && actingEntry.superset}
	anchor={exerciseAnchor}
	onswap={() => (swapOpen = true)}
	onsuperset={() => (supersetOpen = true)}
	onbreak={breakSuperset}
	onremove={removeExercise}
	ongrip={gripExercise}
	onmoveup={actingIndex > 0 ? () => moveActing(actingIndex - 1) : undefined}
	onmovedown={actingIndex >= 0 && actingIndex < entries.length - 1
		? () => moveActing(actingIndex + 1)
		: undefined}
/>

<ExertionDialog
	bind:open={exertionOpen}
	scale={exertionScale.current}
	value={optionsCursor?.set.rpe ?? null}
	onapply={rateSet}
/>

<WorkoutOptionsMenu
	bind:open={menuOpen}
	{title}
	anchor={menuAnchor}
	linked={template !== null}
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
	onunlog={unlogSet}
	onclear={clearSet}
	onremove={removeSet}
	ongrip={gripSet}
	onarms={armSet}
	onexertion={desk ? () => (exertionOpen = true) : undefined}
/>

<AlertDialog
	bind:open={unlockOpen}
	title="Edit this record?"
	description="Changes land in history, hints and records as you make them, on every device."
	confirmLabel="Edit"
	confirmVariant="primary"
	onconfirm={startEditing}
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
