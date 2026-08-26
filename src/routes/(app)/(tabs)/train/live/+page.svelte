<script module lang="ts">
	// Where the lifter left the pane. The page is remade on every arrival and a tab tap is a
	// push rather than a popstate, so SvelteKit's own snapshot never fires on the way back in.
	// Keyed by workout: a session that ends takes its position with it.
	let resting: { workoutId: string; top: number } | null = null;
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import { flip } from 'svelte/animate';
	import { goto, invalidate } from '$app/navigation';

	import { catalogById } from '$lib/catalog';
	import { restAfter } from '$lib/domain/rest';
	import { canCommit, prefillFor } from '$lib/domain/workout';
	import type { Arms } from '$lib/domain/workout';
	import { fillAppBar } from '$lib/nav/bar.svelte';
	import { exertionScale } from '$lib/settings/exertion.svelte';
	import { restSettings } from '$lib/settings/rest.svelte';
	import { syncSoon } from '$lib/sync/client';
	import { restTimer } from '$lib/workout/rest.svelte';
	import { entriesWithMeta, entryOf, legOf, setNote, shelfOf } from '$lib/workout/groups';
	import { activeWorkout, SESSION_DEP } from '$lib/workout/active.svelte';
	import EntryStack from '$lib/workout/EntryStack.svelte';
	import ExerciseBlock from '$lib/workout/ExerciseBlock.svelte';
	import ExerciseOptionsMenu from '$lib/workout/ExerciseOptionsMenu.svelte';
	import ExercisePickerSheet from '$lib/workout/ExercisePickerSheet.svelte';
	import ExertionDialog from '$lib/workout/ExertionDialog.svelte';
	import LiveLedger from '$lib/workout/LiveLedger.svelte';
	import LiveTray from '$lib/workout/LiveTray.svelte';
	import { persistSession } from '$lib/workout/persist.svelte';
	import RestPill from '$lib/workout/RestPill.svelte';
	import SetOptionsMenu from '$lib/workout/SetOptionsMenu.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import { smallMs } from '$lib/ui/motion';
	import { fullyVisible, instantly, revealNearest, revealStart } from '$lib/ui/scroll';
	import { deskViewport } from '$lib/ui/viewport';
	import Stack from '$lib/ui/icons/Stack.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const session = $derived(activeWorkout.session);

	// The lg rung swaps the phone column for the ledger; the tray and its editor stand down
	// there, so the desktop rows carry the editing and the app bar carries the rest.
	const desk = $derived(deskViewport.current);

	let intent: 'jump' | 'advance' = 'advance';
	let scheduled = false;

	let arriving = true;
	let restored = false;

	let pane: HTMLElement | null = null;

	function remember() {
		if (pane !== null && session !== null) {
			resting = { workoutId: session.workout.id, top: pane.scrollTop };
		}
	}

	function restoring(node: HTMLElement) {
		pane = node;

		if (resting === null || session === null || resting.workoutId !== session.workout.id) {
			return;
		}

		node.scrollTop = resting.top;
		restored = true;
	}

	function reveal() {
		const mode = intent;
		intent = 'advance';

		const holder = document.querySelector('[data-active-set]');

		if (!(holder instanceof HTMLElement)) {
			return;
		}

		// Logging a set is not a request to be moved. The pane travels only when the row taking
		// over is out of sight, and only far enough to bring it in — the title stays where it is.
		if (mode === 'advance') {
			revealNearest(holder);

			return;
		}

		// A jump was asked for by name, so it lands on the name: the exercise the set belongs to.
		const head = holder.closest('[data-exercise]')?.querySelector('[data-exercise-head]');

		if (!(head instanceof HTMLElement)) {
			revealNearest(holder);

			return;
		}

		if (fullyVisible(head) && fullyVisible(holder)) {
			return;
		}

		revealStart(head);
	}

	async function settle() {
		if (scheduled) {
			return;
		}

		scheduled = true;
		await tick();
		scheduled = false;

		if (arriving) {
			arriving = false;

			// A restored pane is already where the lifter left it; nothing may pull it away.
			if (!restored) {
				instantly(reveal);
			}
		} else {
			reveal();
		}
	}

	function jumped() {
		// A jump is an explicit act, never an arrival: a session reached with every set logged
		// never runs `settle`, and `arriving` left standing would swallow this scroll whole.
		arriving = false;
		intent = 'jump';
		void settle();
	}

	// A tapped row is the set being lifted now, so a rest still running has been declined —
	// skipped rather than cleared, and the tray offers the undo for a stray thumb.
	function jumpTo(setId: string) {
		if (restTimer.running) {
			restTimer.skip();
		}

		activeWorkout.session?.select(setId);
		jumped();
	}

	$effect(() => {
		if (session === null || session.activeSetId === null) {
			return;
		}

		void settle();
	});

	$effect(() => {
		if (session === null) {
			return;
		}

		persistSession(data.store, session);
	});

	const entries = $derived(session === null ? [] : entriesWithMeta(session.workout, catalogById));

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

	// Rest is earned by a set just done. Advancing may also *clear* a timer — moving on from a
	// set that earns none ends the wait for the one before it — but a set logged behind the
	// cursor must never kill the rest the lifter is standing in.
	function startRest(setId: string, advancing: boolean) {
		if (session === null) {
			return;
		}

		const earned = restAfter(session.workout, setId, restSettings.current);

		if (earned !== null) {
			restTimer.start(earned);
		} else if (advancing) {
			restTimer.clear();
		}
	}

	function logSet(weight: number, reps: number) {
		if (session === null || session.activeSetId === null) {
			return;
		}

		const active = allCursors.find((c) => c.set.id === session.activeSetId);

		// Rewriting a logged set moves on like logging one — the check was pressed, the lifter
		// is done here — but the rest already taken is not owed again, so a running timer is
		// neither restarted nor cleared.
		const rewriting = active !== undefined && active.set.completed;

		const committed = session.commit(weight, reps);

		if (committed === null || rewriting) {
			return;
		}

		startRest(committed, true);
	}

	function quickLog(setId: string, weight: number, reps: number) {
		if (session === null) {
			return;
		}

		const advancing = setId === session.activeSetId;

		if (!session.quickLog(setId, weight, reps)) {
			return;
		}

		startRest(setId, advancing);
	}

	// The tail order is load-bearing — snapshot, holder, then the way out: this address
	// resumes a session out of either while one still says a workout runs.
	async function finishSession() {
		if (session === null) {
			return;
		}

		const keeping = session.hasLoggedSets;
		const { id } = session.workout;

		if (keeping) {
			await data.store.finishWorkout($state.snapshot(session.workout), Date.now());
		}

		await data.store.clearSnapshot();

		if (data.user) {
			syncSoon(data.user.id);
		}

		activeWorkout.finish();

		// A session with nothing in it leaves no record to land on, so it rides its own
		// redirect out: this address bounces to the idle screen once the holder is empty.
		if (!keeping) {
			await invalidate(SESSION_DEP);

			return;
		}

		// Two steps rather than one, and no invalidation first — the bounce would draw the idle
		// screen only to throw it away. History replaces the spent session's entry and the
		// record pushes onto it, so the workout sits on the list exactly as it would had the
		// lifter opened it there, and back walks up to the list rather than into a dead address.
		await goto('/history', { replaceState: true });
		await goto(`/history/${id}`);
	}

	// Same tail order as finishing, minus the record: `/train/live` bounces to the idle screen
	// the moment the holder says no session runs, so no `goto` — there is nothing to land on.
	async function discardSession() {
		if (session === null) {
			return;
		}

		await data.store.clearSnapshot();

		activeWorkout.finish();

		await invalidate(SESSION_DEP);
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

		jumped();
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
		actingEntry === null ? null : shelfOf(entries, actingEntry.id, 'In this session')
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

	let finishing = $state(false);
	let discarding = $state(false);

	const owed = $derived(allCursors.filter((cursor) => !cursor.set.completed).length);

	const logged = $derived(allCursors.filter((cursor) => cursor.set.completed).length);

	// FINISH keeps a workout and discards one, and which it does is `hasLoggedSets` — a predicate
	// the screen never mentions. So the prompt names the act rather than the button: a session
	// with nothing logged leaves no record, and saying "the session ends as it stands" of one
	// that is about to evaporate was the screen lying about the tap it was asking for.
	const finishLabel = $derived(
		owed === 0
			? 'Every set is logged.'
			: `${owed} set${owed === 1 ? '' : 's'} still owed. The session ends as it stands.`
	);

	const emptyLabel = 'Nothing was logged, so this leaves no record.';

	const discardLabel = $derived(
		logged === 0 ? emptyLabel : `${logged} set${logged === 1 ? '' : 's'} logged. Gone for good.`
	);

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

	fillAppBar(() => ({
		title: allCursors.length === 0 ? null : `${logged} of ${allCursors.length} sets`,
		action: finish
	}));

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

		const offer = prefillFor(activeCursor, data.history, activeLeg.meta);

		if (canCommit(offer.weight, offer.reps)) {
			logSet(offer.weight as number, offer.reps as number);
		}
	}
</script>

<svelte:window onkeydown={deskEnter} />

{#snippet finish()}
	<div class="flex items-center gap-2.5">
		{#if desk}
			<RestPill />

			{#if allCursors.length > 0}
				<!-- The app bar's own title hides on lg to make room for the nav, so the count
				     rides along here instead. -->
				<span class="text-md font-extrabold text-ink-faint">
					{logged} of {allCursors.length} sets
				</span>
			{/if}
		{/if}

		<Button variant="chrome" caps onclick={() => (finishing = true)}>FINISH</Button>
	</div>
{/snippet}

<svelte:head>
	<title>Workout | Kilorep</title>
</svelte:head>

{#if session !== null}
	<div class="flex min-h-0 flex-1 flex-col">
		{#if allCursors.length > 1}
			<!-- `scrollbar-gutter` on both this strip and the pane below: a classic scrollbar
			     narrows the pane's content box but not this one's, and the two `mx-auto` centres
			     drift apart by half its width. Reserving the same gutter here (hidden overflow
			     makes this a scroll container, which is all the property asks) keeps the bar and
			     the ledger on one axis. -->
			<div class="shrink-0 [scrollbar-gutter:stable] overflow-y-hidden px-3 pt-2 lg:px-4">
				<div aria-hidden="true" class="mx-auto flex w-full max-w-xl gap-[3px] lg:max-w-5xl">
					{#each allCursors as cursor (cursor.set.id)}
						<span
							class={[
								'h-1 min-w-0 flex-1 rounded-full',
								cursor.set.completed
									? 'bg-accent'
									: cursor.set.id === session.activeSetId
										? 'bg-accent-soft [outline:1.5px_solid_var(--accent)] [outline-offset:-1px]'
										: 'bg-line'
							]}
						></span>
					{/each}
				</div>
			</div>
		{/if}

		<main
			onscroll={remember}
			class="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto py-3 pb-6"
			{@attach restoring}
		>
			{#if entries.length === 0}
				<div class="mx-auto flex min-h-full w-full max-w-xl flex-col gap-7 px-3">
					<EmptyState title="Empty session" description="Add an exercise to start logging.">
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
						history={data.history}
						activeSetId={session.activeSetId}
						onselect={jumpTo}
						onquick={quickLog}
						oncommit={logSet}
						ondraft={(weight, reps) => {
							if (session.activeSetId !== null) {
								session.draft(session.activeSetId, weight, reps);
							}
						}}
						onrate={(rpe) => {
							if (session.activeSetId !== null) {
								session.rate(session.activeSetId, rpe);
							}
						}}
						onadd={(exerciseId) => session.addSet(exerciseId)}
						oninsert={insertFrom}
						onoptions={options}
						onexercise={exerciseOptions}
						onreorder={(entryId, index) => session.moveEntry(entryId, index)}
					/>

					<Button variant="destructive" class="w-full" onclick={() => (discarding = true)}>
						<Trash size={20} />
						Discard workout
					</Button>
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
										history={data.history}
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

					<Button variant="destructive" class="w-full" onclick={() => (discarding = true)}>
						<Trash size={20} />
						Discard workout
					</Button>
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
				history={data.history}
				total={allCursors.length}
				oncommit={logSet}
				ondraft={(weight, reps) => {
					if (session.activeSetId !== null) {
						session.draft(session.activeSetId, weight, reps);
					}
				}}
				onrate={(rpe) => {
					if (session.activeSetId !== null) {
						session.rate(session.activeSetId, rpe);
					}
				}}
				onoptions={(anchor) => {
					if (session.activeSetId !== null) {
						options(session.activeSetId, anchor);
					}
				}}
				onfinish={() => (finishing = true)}
			/>
		{/if}
	</div>

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

	<ExertionDialog
		bind:open={exertionOpen}
		scale={exertionScale.current}
		value={optionsCursor?.set.rpe ?? null}
		onapply={rateSet}
	/>

	<AlertDialog
		bind:open={finishing}
		title={logged === 0 ? 'Discard workout?' : 'Finish workout?'}
		description={logged === 0 ? emptyLabel : finishLabel}
		confirmLabel={logged === 0 ? 'Discard' : 'Finish'}
		onconfirm={() => void finishSession()}
	/>

	<AlertDialog
		bind:open={discarding}
		title="Discard workout?"
		description={discardLabel}
		confirmLabel="Discard"
		onconfirm={() => void discardSession()}
	/>
{/if}
