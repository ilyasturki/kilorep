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
	import OverviewDrawer from '$lib/workout/OverviewDrawer.svelte';
	import OverviewPeek from '$lib/workout/OverviewPeek.svelte';
	import { persistSession } from '$lib/workout/persist.svelte';
	import RestBar from '$lib/workout/RestBar.svelte';
	import RestPill from '$lib/workout/RestPill.svelte';
	import SetOptionsMenu from '$lib/workout/SetOptionsMenu.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import { mediumMs, smallMs } from '$lib/ui/motion';
	import { coarsePointer } from '$lib/ui/pointer';
	import { press, SLOP } from '$lib/ui/press';
	import { fullyVisible, instantly, revealNearest, revealStart } from '$lib/ui/scroll';
	import { deskViewport } from '$lib/ui/viewport';
	import Stack from '$lib/ui/icons/Stack.svelte';

	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const session = $derived(activeWorkout.session);

	// The lg rung swaps the phone column for the ledger; the tray and its editor stand down
	// there, so the desktop rows carry the editing and the app bar carries the rest.
	const desk = $derived(deskViewport.current);

	// Whether the tray stands over the bottom edge. Lowered by its handle, to hand the height
	// back to the list; raised by the three things that make it the screen's business again —
	// a set tapped, a set logged, a rest run out.
	let trayOpen = $state(true);

	// The tray stands over the list rather than beside it, so the list keeps this much of its
	// own floor clear: enough that the last row can be scrolled out from under the tray, and
	// handed straight back when the tray goes down.
	let traySpan = $state(0);

	const floor = $derived(trayOpen ? traySpan : 0);

	const restShowing = $derived(restTimer.running || restTimer.undoing);

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

		trayOpen = true;
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

	// Rest running out is the set coming up, so the tray comes back with it. Guarded on the
	// edge rather than the state: `overtime` stays true for as long as the lifter leaves the
	// clock over, and re-running it every tick would pin the tray open against the handle.
	let rang = false;

	$effect(() => {
		if (!restTimer.overtime) {
			rang = false;

			return;
		}

		if (rang) {
			return;
		}

		rang = true;
		trayOpen = true;
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

		// A set logged by swipe is the one way to work with the tray down, and the set it
		// hands over to is the tray's business — so logging one asks for it back.
		trayOpen = true;

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

	// The session drawer, and the pull that opens it. It takes the whole page rather than an
	// edge strip — but never a pull that started on a set row, which owns the same axis for
	// logging and unlogging. A row is the one place on this screen where sideways already
	// means something, so it keeps it and the rest of the page opens the drawer.
	let overview = $state(false);
	let instant = $state(false);

	let peek = $state<number | null>(null);
	let peekWidth = $state(0);
	let settling = $state(false);

	let swipe: { id: number; x0: number; y0: number; x: number; at: number; v: number } | null = null;
	let swallow = false;

	const SETTLE_AT = 0.4;

	/** px per ms of rightward flick that opens the panel from anywhere. */
	const FLING = 0.5;

	function swipeStart(event: PointerEvent) {
		swallow = false;

		if (desk || !coarsePointer || !event.isPrimary || overview || peek !== null) {
			swipe = null;
			return;
		}

		// Inside the list and nowhere else. The tray below it is a working surface of steppers
		// and chips, and a row inside it owns this axis already — right on a row logs the set,
		// left takes it out. Everything else the list is made of has nothing sideways to say,
		// which is what leaves the gesture free to mean the drawer.
		const target = event.target;

		if (
			!(target instanceof Element) ||
			pane === null ||
			!pane.contains(target) ||
			target.closest('[data-swipe-row]') !== null
		) {
			swipe = null;
			return;
		}

		swipe = {
			id: event.pointerId,
			x0: event.clientX,
			y0: event.clientY,
			x: event.clientX,
			at: event.timeStamp,
			v: 0
		};
	}

	function swipeMove(event: PointerEvent & { currentTarget: HTMLElement }) {
		if (swipe === null || event.pointerId !== swipe.id) {
			return;
		}

		const span = event.timeStamp - swipe.at;

		if (span > 0) {
			swipe.v = (event.clientX - swipe.x) / span;
			swipe.x = event.clientX;
			swipe.at = event.timeStamp;
		}

		const dx = event.clientX - swipe.x0;
		const dy = Math.abs(event.clientY - swipe.y0);

		if (peek !== null) {
			peek = Math.max(0, Math.min(dx, peekWidth));
			return;
		}

		if (dy > SLOP && dy > dx) {
			swipe = null;
			return;
		}

		if (dx > SLOP && dx > 2 * dy) {
			event.currentTarget.setPointerCapture(swipe.id);
			peek = dx;
		}
	}

	function settled() {
		settling = false;

		if (peek === 0) {
			peek = null;
			return;
		}

		instant = true;
		overview = true;

		requestAnimationFrame(() => {
			peek = null;
		});
	}

	function swipeEnd() {
		if (swipe === null || peek === null) {
			swipe = null;
			return;
		}

		const opened = peek >= peekWidth * SETTLE_AT || swipe.v > FLING;
		const target = opened ? peekWidth : 0;

		swipe = null;
		swallow = true;

		// A transition with nothing to do never fires `transitionend`, so settle here instead.
		if (target === peek || mediumMs() === 0) {
			peek = target;
			settled();
			return;
		}

		settling = true;
		peek = target;
	}

	$effect(() => {
		if (!overview) {
			instant = false;
		}
	});

	function swipeClick(event: MouseEvent) {
		if (!swallow) {
			return;
		}

		swallow = false;
		event.preventDefault();
		event.stopImmediatePropagation();
	}

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

	// A logged set taken back by a gesture. The cursor lands on it, so the tray comes up
	// showing the numbers that were there — taking a log back is almost always the first half
	// of writing a better one.
	function unlogFrom(setId: string) {
		if (session === null) {
			return;
		}

		session.unlogSet(setId);
		trayOpen = true;
	}

	// Frozen at the ask, like the options sheets: the dialog reads this after the set is gone.
	let removing = $state<{ id: string; title: string; lost: string } | null>(null);
	let removingOpen = $state(false);

	function removeFrom(setId: string) {
		if (session === null) {
			return;
		}

		const cursor = allCursors.find((c) => c.set.id === setId);

		if (cursor === undefined) {
			return;
		}

		// An empty row is nothing to lose, and asking about it would be the screen making a
		// ceremony of clearing a blank line. A logged one holds a number nothing can put back.
		if (!cursor.set.completed) {
			session.removeSet(setId);

			return;
		}

		removing = {
			id: setId,
			title: cursor.workingIndex < 0 ? 'Remove warmup?' : `Remove set ${cursor.workingIndex + 1}?`,
			lost: `${cursor.set.weight} × ${cursor.set.reps} goes with it, and nothing in the app can put it back.`
		};

		removingOpen = true;
	}

	function removeConfirmed() {
		if (session === null || removing === null) {
			return;
		}

		session.removeSet(removing.id);
		removing = null;
	}

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
		leading: overviewButton,
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

<!-- Where the drawer is found by someone who never swipes. Beside back, because that is the
     side it comes in from — and `lg:hidden` because the desktop ledger is the same list, laid
     out rather than hidden behind a gesture. -->
{#snippet overviewButton()}
	<button
		type="button"
		aria-label="Session overview"
		onclick={() => (overview = true)}
		class="grid min-h-chrome w-11 shrink-0 place-items-center rounded-full border
			border-line text-ink-muted focus-ring hover:bg-hover lg:hidden
			press:bg-surface-2"
		{@attach press()}
	>
		<Stack size={20} />
	</button>
{/snippet}

<!-- No ⋮ here any more: its one item was Discard workout, and the drawer carries that at its
     own foot, under the list the act is about. -->
{#snippet finish()}
	<div class="flex items-center gap-2.5">
		{#if desk}
			<RestPill />
		{/if}

		<Button variant="chrome" caps onclick={() => (finishing = true)}>FINISH</Button>
	</div>
{/snippet}

<svelte:head>
	<title>Workout | Kilorep</title>
</svelte:head>

{#if session !== null}
	<!-- `relative` because the tray stands inside this box rather than under it, and
	     `overflow-hidden` so a lowered tray leaves the screen instead of the document.
	     The pull that opens the drawer is caught here, above the list and everything in it. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="relative flex min-h-0 flex-1 flex-col overflow-hidden"
		onpointerdown={swipeStart}
		onpointermove={swipeMove}
		onpointerup={swipeEnd}
		onpointercancel={swipeEnd}
		onclickcapture={swipeClick}
	>
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
						from="/train/live"
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
										{floor}
										onselect={jumpTo}
										onquick={quickLog}
										onunlog={unlogFrom}
										onremove={removeFrom}
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

			{#if !desk && entries.length > 0}
				<!-- The floor the tray covers, kept clear inside the scroller so the last row can
				     still be brought out from under it — and handed straight back on the way down,
				     on the tray's own curve, so the two read as one movement. -->
				<div
					aria-hidden="true"
					class={[
						mediumMs() > 0 && 'transition-[height] duration-(--dur-medium) ease-(--ease-medium)'
					]}
					style="height: {floor}px"
				></div>
			{/if}
		</main>

		{#if !desk && entries.length > 0}
			{#if !trayOpen}
				<!-- What stands on the edge the tray gave up. The global bar is kept off this
				     screen while the tray is the timer's face; with the tray down it is the only
				     face left, and it carries the home-indicator inset the tray took with it.
				     Above the tray in the file but under it on screen — the tray is out of flow,
				     so this is already standing where the tray uncovers it. -->
				<div class={['shrink-0 pb-safe-b', restShowing && 'bg-surface']}>
					<RestBar />
				</div>
			{/if}

			<LiveTray
				bind:open={trayOpen}
				bind:span={traySpan}
				cursor={activeCursor}
				meta={activeLeg?.meta}
				note={activeCursor === null
					? null
					: setNote(activeLeg?.meta, activeLeg?.grip, activeCursor.set)}
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

	<OverviewDrawer
		bind:open={overview}
		{instant}
		{entries}
		activeSetId={session.activeSetId}
		onjump={jumpTo}
		oninsert={() => insertFrom(null)}
		onreorder={(entryId, index) => session.moveEntry(entryId, index)}
		ondrop={jumped}
		ondiscard={() => (discarding = true)}
	/>

	{#if peek !== null}
		<OverviewPeek
			offset={peek}
			bind:width={peekWidth}
			{settling}
			{entries}
			activeSetId={session.activeSetId}
			onsettled={settled}
		/>
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
		from="/train/live"
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

	<AlertDialog
		bind:open={removingOpen}
		title={removing?.title ?? 'Remove set?'}
		description={removing?.lost}
		confirmLabel="Remove"
		onconfirm={removeConfirmed}
	/>
{/if}
