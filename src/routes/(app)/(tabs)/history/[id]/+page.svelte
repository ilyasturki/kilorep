<script lang="ts">
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import { parseDate } from '@internationalized/date';
	import type { DateValue } from '@internationalized/date';

	import { catalogById } from '$lib/catalog';
	import { localDateOf } from '$lib/domain/bodyweight';
	import type { Exercise } from '$lib/domain/exercise';
	import { gripLabel } from '$lib/domain/grip';
	import { applyDrift, driftFrom, hasDrift, hasSetDrift } from '$lib/domain/drift';
	import type { SetDrift } from '$lib/domain/drift';
	import { lastedOf, timeOf } from '$lib/domain/retime';
	import { isArchived, rankAfter, startable, templateFrom } from '$lib/domain/template';
	import type { Template } from '$lib/domain/template';
	import { untouched } from '$lib/domain/workout';
	import type { Arms, SetType, SwapMode, WorkoutExercise } from '$lib/domain/workout';
	import type { Pick } from '$lib/exercises/picker';
	import { RecordEditor } from '$lib/history/editor.svelte';
	import { lastedLabel, workoutTitle } from '$lib/history/label';
	import { launchRepeat, repeatBlocked } from '$lib/history/repeat';
	import RecordLedger from '$lib/history/RecordLedger.svelte';
	import WorkoutOptionsMenu from '$lib/history/WorkoutOptionsMenu.svelte';
	import PlanOffer from '$lib/templates/PlanOffer.svelte';
	import PlanPickerSheet from '$lib/templates/PlanPickerSheet.svelte';
	import { fillAppBar, openedFrom } from '$lib/nav/bar.svelte';
	import { barIcon } from '$lib/nav/chrome';
	import { leave } from '$lib/nav/go';
	import { exertionScale } from '$lib/settings/exertion.svelte';
	import { syncSoon } from '$lib/sync/client';
	import { entriesWithMeta, entryOf, legOf, shelfOf } from '$lib/workout/groups';
	import ExerciseOptionsMenu from '$lib/workout/ExerciseOptionsMenu.svelte';
	import ExercisePickerSheet from '$lib/workout/ExercisePickerSheet.svelte';
	import ExertionDialog from '$lib/workout/ExertionDialog.svelte';
	import NoteSheet from '$lib/workout/NoteSheet.svelte';
	import SetOptionsMenu from '$lib/workout/SetOptionsMenu.svelte';
	import SwapSetsDialog from '$lib/workout/SwapSetsDialog.svelte';
	import AddRow from '$lib/ui/AddRow.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import DatePicker from '$lib/ui/DatePicker.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import { registerOverlay } from '$lib/ui/overlays';
	import { deskViewport } from '$lib/ui/viewport';
	import ClockCounterClockwise from '$lib/ui/icons/ClockCounterClockwise.svelte';
	import More from '$lib/ui/icons/More.svelte';
	import Pencil from '$lib/ui/icons/Pencil.svelte';
	import StackPlus from '$lib/ui/icons/StackPlus.svelte';
	import { press } from '$lib/ui/press';

	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	const workout = $state(data.workout);

	let editor = $state<RecordEditor | null>(null);

	const editing = $derived(editor !== null);

	const shown = $derived(editor === null ? workout : editor.draft);

	// `??`, not `=== null`: records written before `templateId` existed lack the key.
	const template = $derived(
		data.templates.find((candidate) => candidate.id === (shown.templateId ?? null)) ?? null
	);

	// Archived plans last rather than absent: a session imported from a retired plan is
	// exactly the one that needs naming.
	const plans = $derived([...startable(data.templates), ...data.templates.filter(isArchived)]);

	const title = $derived(workoutTitle(shown, template === null ? [] : [template]));
	const drift = $derived(
		template === null ? null : driftFrom(shown, template, (id) => catalogById[id])
	);

	const entries = $derived(entriesWithMeta(shown, catalogById));

	const address = $derived(`/history/${workout.id}`);

	const desk = $derived(deskViewport.current);

	const when = new Intl.DateTimeFormat('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});

	const lasted = $derived(lastedLabel(lastedOf(shown)));

	const startedOn = $derived(localDateOf(new Date(shown.startedAt)));

	const day = $derived(parseDate(startedOn));

	function moveTo(picked: DateValue | undefined) {
		if (picked !== undefined) {
			editor?.moveTo(picked.toString());
		}
	}

	function begin() {
		editor ??= new RecordEditor($state.snapshot(workout));
	}

	function stop() {
		editor = null;
	}

	// A figure cell commits its number only on blur.
	function settleFigure() {
		const focused = document.activeElement;

		if (focused instanceof HTMLInputElement && focused.dataset.figure !== undefined) {
			focused.blur();
		}
	}

	let saving = false;

	// The draft stays open until the write lands: a refused write leaves it to be saved again.
	async function save() {
		settleFigure();

		const draft = editor;

		if (draft === null || saving) {
			return;
		}

		saving = true;

		try {
			const wrote = await draft.save(data.store, Date.now());

			Object.assign(workout, draft.record());
			editor = null;

			if (wrote && data.user) {
				syncSoon(data.user.id);
			}
		} finally {
			saving = false;
		}
	}

	let leaveOpen = $state(false);

	// The navigation the dialog stopped, resumed once Discard is confirmed.
	let pending: (() => void) | null = null;

	function discard() {
		settleFigure();

		if (editor === null || !editor.dirty) {
			stop();

			return;
		}

		pending = null;
		leaveOpen = true;
	}

	function drop() {
		stop();

		const go = pending;

		pending = null;
		go?.();
	}

	let release: (() => void) | null = null;

	// The stack popped this overlay before calling here, so asking first re-registers it.
	function back() {
		discard();

		if (editor !== null) {
			release = registerOverlay(back);
		}
	}

	$effect(() => {
		if (!editing) {
			return;
		}

		release = registerOverlay(back);

		return () => {
			release?.();
			release = null;
		};
	});

	beforeNavigate((navigation) => {
		if (editor === null) {
			return;
		}

		settleFigure();

		if (!editor.dirty) {
			return;
		}

		navigation.cancel();

		const to = navigation.to?.url;

		if (navigation.type === 'popstate') {
			const { delta } = navigation;

			pending = () => history.go(delta);
		} else if (navigation.type === 'leave' || to === undefined) {
			return;
		} else if (navigation.willUnload) {
			pending = () => location.assign(to);
		} else {
			pending = () => void goto(to);
		}

		leaveOpen = true;
	});

	let insertOpen = $state(false);

	function insertPicks(picks: Pick[]) {
		editor?.session.addExercises(picks);
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

	const present = $derived(
		shown.entries.flatMap((entry) => entry.exercises.map((e) => e.exerciseId))
	);

	let exerciseAnchor = $state<HTMLElement | null>(null);

	function exerciseOptions(exerciseId: string, anchor: HTMLElement) {
		acting = exerciseId;
		exerciseAnchor = anchor;
		exerciseOpen = true;
	}

	function gripExercise(grip: string) {
		if (editor === null || acting === null) {
			return;
		}

		editor.session.setExerciseGrip(acting, grip);
		acting = null;
	}

	function moveActing(to: number) {
		if (editor === null || actingEntry === null) {
			return;
		}

		editor.session.moveEntry(actingEntry.id, to);
		acting = null;
	}

	// Frozen at the pick, like the options sheets: the dialog reads it after the picker closes.
	let swapping = $state<{
		exerciseId: string;
		pick: Pick;
		from: string;
		to: string;
		logged: number;
	} | null>(null);

	let swapAsk = $state(false);

	function swapPick([pick]: Pick[]) {
		if (editor === null || acting === null || actingLeg === null || pick === undefined) {
			return;
		}

		const logged = actingLeg.cursors.filter((cursor) => cursor.set.completed).length;

		if (logged === 0) {
			editor.session.swapExercise(acting, pick, 'delete');
			acting = null;

			return;
		}

		swapping = {
			exerciseId: acting,
			pick,
			from: actingLeg.meta.name,
			to: catalogById[pick.exerciseId]?.name ?? pick.exerciseId,
			logged
		};
		swapAsk = true;
	}

	function swapChosen(mode: SwapMode) {
		if (editor === null || swapping === null) {
			return;
		}

		editor.session.swapExercise(swapping.exerciseId, swapping.pick, mode);
		acting = null;
	}

	function supersetPicks(picks: Pick[]) {
		if (editor === null || actingEntry === null) {
			return;
		}

		editor.session.superset(actingEntry.id, picks);
		acting = null;
	}

	function breakSuperset() {
		if (editor === null || actingEntry === null) {
			return;
		}

		editor.session.breakSuperset(actingEntry.id);
		acting = null;
	}

	function warmUpActing() {
		if (editor === null || acting === null) {
			return;
		}

		editor.session.addWarmup(acting);
		acting = null;
	}

	let noteOpen = $state(false);
	let noting = $state<string | null>(null);

	const notingLeg = $derived(legOf(entries, noting));

	function noteActing() {
		noting = acting;
		noteOpen = true;
		acting = null;
	}

	function saveNote(text: string) {
		if (editor !== null && noting !== null) {
			editor.session.setNote(noting, text);
		}
	}

	function leaveSuperset() {
		if (editor === null || acting === null) {
			return;
		}

		editor.session.leaveSuperset(acting);
		acting = null;
	}

	const actingLegIndex = $derived(
		actingEntry === null || acting === null
			? -1
			: actingEntry.legs.findIndex((leg) => leg.id === acting)
	);

	function moveLeg(towards: -1 | 1) {
		if (editor === null || acting === null) {
			return;
		}

		editor.session.moveExercise(acting, towards);
		acting = null;
	}

	function removeExercise() {
		if (editor === null || acting === null) {
			return;
		}

		editor.session.removeExercise(acting);
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

	// Each of these acts on the set the sheet was opened on, which outlives the sheet.
	function onOptionsSet(act: (editor: RecordEditor, setId: string) => void) {
		if (editor !== null && optionsSetId !== null) {
			act(editor, optionsSetId);
		}
	}

	let exertionOpen = $state(false);

	function badgeMarks(setDrift: SetDrift, meta: Exercise | undefined): string[] {
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

	function badgesFor(leg: WorkoutExercise | undefined, meta: Exercise | undefined): string[] {
		if (leg !== undefined && untouched(leg)) {
			return ['Skipped, optional'];
		}

		if (drift === null || leg === undefined) {
			return [];
		}

		const setDrift = drift.matched[leg.id];

		if (setDrift === undefined) {
			return ['Unplanned'];
		}

		return hasSetDrift(setDrift) ? badgeMarks(setDrift, meta) : [];
	}

	let menuOpen = $state(false);
	let menuAnchor = $state<HTMLElement | null>(null);

	let linkOpen = $state(false);

	// Written at once, outside the draft: relinking never asks for a Save.
	async function relink(templateId: string | null) {
		workout.templateId = templateId;

		await data.store.updateWorkout($state.snapshot(workout), Date.now());

		if (data.user) {
			syncSoon(data.user.id);
		}
	}

	// Read once: answering the offer changes what the load says, and the banner stays to say so.
	// svelte-ignore state_referenced_locally
	const { offer } = data;

	const offering = $derived(
		offer.open && (template === null || (template.id === offer.templateId && !isArchived(template)))
	);

	async function updatePlan(swaps: string[]) {
		if (template === null) {
			return;
		}

		const now = Date.now();
		const plan = $state.snapshot(template);

		applyDrift(
			plan,
			$state.snapshot(workout),
			(id) => catalogById[id],
			() => crypto.randomUUID(),
			swaps
		);

		await data.store.saveTemplate(plan, now);
		await data.store.answerOffer(plan.id, workout.id, now);

		if (data.user) {
			syncSoon(data.user.id);
		}

		await invalidateAll();
	}

	async function dismissOffer() {
		await data.store.answerOffer(offer.templateId, workout.id, Date.now());

		if (data.user) {
			syncSoon(data.user.id);
		}
	}

	async function saveAsPlan() {
		const now = Date.now();
		const plan = templateFrom($state.snapshot(workout), crypto.randomUUID(), now, () =>
			crypto.randomUUID()
		);

		plan.order = rankAfter(data.templates);

		await data.store.saveTemplate(plan, now);

		workout.templateId = plan.id;

		await data.store.updateWorkout($state.snapshot(workout), now);

		if (data.user) {
			syncSoon(data.user.id);
		}

		await goto(openedFrom(`/plan/templates/${plan.id}`, `/history/${workout.id}`));
	}

	let deleteOpen = $state(false);

	async function deleteWorkout() {
		await data.store.deleteWorkout(workout.id, Date.now());

		if (data.user) {
			syncSoon(data.user.id);
		}

		await leave('/history');
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
		<div class="flex items-center gap-2">
			<Button variant="bar" caps onclick={discard}>DISCARD</Button>

			<button
				type="button"
				onclick={() => void save()}
				class="inline-flex min-h-chrome press-sink items-center rounded-full bg-accent px-4
					text-sm font-extrabold tracking-caps text-on-accent focus-ring hover:bg-accent-hover
					press:[filter:var(--accent-press)]"
				{@attach press()}
			>
				SAVE
			</button>
		</div>
	{:else}
		<div class="flex items-center gap-1">
			{#if desk}
				<Button variant="bar" caps onclick={() => void repeat()}>REPEAT</Button>

				<button
					type="button"
					aria-label="Edit this workout"
					onclick={begin}
					class={barIcon}
					{@attach press()}
				>
					<Pencil size={18} />
				</button>
			{/if}

			<button
				type="button"
				aria-label="Workout options"
				onclick={(e) => {
					menuAnchor = e.currentTarget;
					menuOpen = true;
				}}
				class={barIcon}
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

<main class="min-h-0 flex-1 overflow-y-auto">
	<div class="column-content flex min-h-full flex-col gap-5 px-3 pt-3 pb-6">
		<p class="px-1 text-md font-bold text-ink-faint">
			{when.format(shown.startedAt)} · {timeOf(shown.startedAt)}
			{#if lasted !== null}· {lasted}{/if}
			{#if drift !== null && !hasDrift(drift)}· as planned{/if}
		</p>

		{#if offering && !editing}
			<PlanOffer
				{workout}
				{template}
				where="record"
				onupdate={updatePlan}
				onsave={saveAsPlan}
				ondismiss={dismissOffer}
			/>
		{/if}

		{#if editing}
			<!-- The day moves and the hour stays, the session as long as it ever was. -->
			<DatePicker label="Date" maxToday class="px-1" bind:value={() => day, moveTo} />
		{/if}

		<div class="flex flex-1 flex-col gap-3">
			{#if entries.length === 0}
				<div class="flex flex-1 flex-col justify-center">
					<EmptyState
						title="Nothing in this workout"
						description={editing
							? 'Add the exercises it held.'
							: 'Every exercise has been removed.'}
					>
						{#snippet icon()}
							<ClockCounterClockwise size={24} />
						{/snippet}
					</EmptyState>
				</div>
			{:else}
				{#each entries as entry (entry.id)}
					<RecordLedger
						legs={entry.legs}
						cursors={entry.cursors}
						badges={(leg) => badgesFor(leg.cursors[0]?.exercise, leg.meta)}
						instead={(leg) => {
							const planned = drift?.matched[leg.id]?.instead;

							return planned === undefined || planned === null
								? undefined
								: (catalogById[planned]?.name ?? planned);
						}}
						from={address}
						{editing}
						onbegin={begin}
						onfigure={(setId, which, value) => editor?.figure(setId, which, value)}
						onoptions={options}
						onexercise={exerciseOptions}
						onadd={() => editor?.session.addRound(entry.id)}
					/>
				{/each}
			{/if}

			{#if editing}
				<AddRow label="Add exercise" icon={StackPlus} onclick={() => (insertOpen = true)} />
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

<ExercisePickerSheet
	bind:open={insertOpen}
	title="Add exercise"
	multiple
	frequent={data.frequent}
	{present}
	presentLabel="In workout"
	lastPerformed={data.lastPerformed}
	onpick={insertPicks}
/>

<ExercisePickerSheet
	bind:open={swapOpen}
	title="Swap exercise"
	replacing={actingLeg === null ? null : actingLeg.meta}
	{present}
	presentLabel="In workout"
	lastPerformed={data.lastPerformed}
	heaviest={data.heaviest}
	onpick={swapPick}
/>

<SwapSetsDialog
	bind:open={swapAsk}
	from={swapping?.from ?? ''}
	to={swapping?.to ?? ''}
	logged={swapping?.logged ?? 0}
	onchoose={swapChosen}
/>

<ExercisePickerSheet
	bind:open={supersetOpen}
	title="Superset {actingLeg === null ? 'exercise' : actingLeg.meta.name} with…"
	multiple
	verb="Superset"
	pinned={supersetShelf}
	{present}
	presentLabel="In workout"
	lastPerformed={data.lastPerformed}
	onpick={supersetPicks}
/>

<ExerciseOptionsMenu
	bind:open={exerciseOpen}
	group={actingLeg}
	superset={actingEntry !== null && actingEntry.superset}
	anchor={exerciseAnchor}
	from={address}
	undoable
	onswap={() => (swapOpen = true)}
	onsuperset={() => (supersetOpen = true)}
	onbreak={actingEntry !== null && actingEntry.legs.length > 2 ? breakSuperset : undefined}
	onleave={leaveSuperset}
	onaddset={() => {
		if (acting !== null) {
			editor?.session.addSet(acting);
		}
	}}
	onahead={actingLegIndex > 0 ? () => moveLeg(-1) : undefined}
	onbehind={actingEntry !== null &&
	actingLegIndex >= 0 &&
	actingLegIndex < actingEntry.legs.length - 1
		? () => moveLeg(1)
		: undefined}
	onremove={removeExercise}
	ongrip={gripExercise}
	onwarmup={warmUpActing}
	onnote={noteActing}
	onmoveup={actingIndex > 0 ? () => moveActing(actingIndex - 1) : undefined}
	onmovedown={actingIndex >= 0 && actingIndex < entries.length - 1
		? () => moveActing(actingIndex + 1)
		: undefined}
/>

<ExertionDialog
	bind:open={exertionOpen}
	scale={exertionScale.current}
	value={optionsCursor?.set.rpe ?? null}
	onapply={(rpe) => onOptionsSet((draft, setId) => draft.session.rate(setId, rpe))}
/>

<WorkoutOptionsMenu
	bind:open={menuOpen}
	{title}
	anchor={menuAnchor}
	linked={template !== null}
	onrepeat={desk ? undefined : () => void repeat()}
	onedit={desk ? undefined : begin}
	onlink={() => (linkOpen = true)}
	onsave={template === null ? () => void saveAsPlan() : undefined}
	ondelete={() => (deleteOpen = true)}
/>

<PlanPickerSheet
	bind:open={linkOpen}
	title={template === null ? 'Link to a plan' : 'Change plan'}
	templates={plans}
	currentId={template === null ? null : template.id}
	onpick={(picked: Template) => void relink(picked.id)}
	onclear={template === null ? undefined : () => void relink(null)}
/>

<SetOptionsMenu
	bind:open={optionsOpen}
	cursor={optionsCursor}
	meta={optionsGroup?.meta}
	anchor={optionsAnchor}
	removable={optionsGroup !== null && optionsGroup.cursors.length > 1}
	undoable
	onunlog={() => onOptionsSet((draft, setId) => draft.unlog(setId))}
	onlog={() => onOptionsSet((draft, setId) => draft.log(setId))}
	onclear={() => onOptionsSet((draft, setId) => draft.session.clear(setId))}
	onremove={() => onOptionsSet((draft, setId) => draft.session.removeSet(setId))}
	ongrip={(grip) => onOptionsSet((draft, setId) => draft.session.setSetGrip(setId, grip))}
	onarms={(arms: Arms) => onOptionsSet((draft, setId) => draft.session.setSetArms(setId, arms))}
	ontype={(type: SetType) => onOptionsSet((draft, setId) => draft.session.setSetType(setId, type))}
	onexertion={() => (exertionOpen = true)}
/>

<NoteSheet
	bind:open={noteOpen}
	name={notingLeg === null ? 'Note' : notingLeg.meta.name}
	note={notingLeg?.note}
	onsave={saveNote}
/>

<AlertDialog
	bind:open={leaveOpen}
	title="Discard your changes?"
	description="The workout stays as it was before you started editing."
	confirmLabel="Discard"
	onconfirm={drop}
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
