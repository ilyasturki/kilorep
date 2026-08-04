<script lang="ts">
	import { tick } from 'svelte';
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';
	import { MediaQuery } from 'svelte/reactivity';
	import { goto, invalidate } from '$app/navigation';

	import { catalogById } from '$lib/catalog';
	import { appBarSlot } from '$lib/nav/bar.svelte';
	import { syncSoon } from '$lib/sync/client';
	import { groupsWithMeta } from '$lib/workout/groups';
	import { activeWorkout, SESSION_DEP } from '$lib/workout/active.svelte';
	import ExerciseBlock from '$lib/workout/ExerciseBlock.svelte';
	import ExerciseOptionsSheet from '$lib/workout/ExerciseOptionsSheet.svelte';
	import ExercisePickerSheet from '$lib/workout/ExercisePickerSheet.svelte';
	import OverviewDrawer from '$lib/workout/OverviewDrawer.svelte';
	import SessionList from '$lib/workout/SessionList.svelte';
	import SetOptionsSheet from '$lib/workout/SetOptionsSheet.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import { revealNearest } from '$lib/ui/scroll';
	import Check from '$lib/ui/icons/Check.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';

	import type { PageProps } from './$types';

	/**
	 * The workout screen: the whole session stacked, the active set expanded in
	 * place inside it.
	 *
	 * PRODUCT.md left focused-one-exercise-at-a-time and full-session-list open,
	 * and both shipped here behind `?mode=` so a run through the fixture could
	 * decide it. The list won; the fork, the focused branch and its transition
	 * are gone. What the list costs is one thing, and it stays: `ExerciseBlock`
	 * pulls the active set back inside the pane after a commit, because in a
	 * stacked session it otherwise marches off the bottom of the page.
	 *
	 * From `lg` up the session list the sheet holds on a phone is a card floating
	 * in the left gutter, beside the pane being logged into rather than in front
	 * of it: the pane stays where every other screen's column is, and the card
	 * lives in the margin the window has left over. The rail and the app bar
	 * arrive at the same breakpoint — the column cap steps down at `lg` to make
	 * the gutter that pays for it, see `app.css` — so the overview button lives
	 * in the phone header and nowhere else; there is no longer a band where the
	 * bar is up but the rail is not.
	 *
	 * The header is this screen's own below `lg` and the app's bar above it. The
	 * screen is chrome-less on a phone because hard rule 7 says so, and that rule
	 * is about a tired thumb on a gym floor — it has nothing to say about a mouse
	 * at a desk, where a second bar stacked under the app's would be the only
	 * page in the app that looked different for no reason. FINISH is the same
	 * button either way; it is declared once below and rendered into whichever
	 * header is on screen.
	 *
	 * This address is the session and holds no second posture. `/workout` is the
	 * idle screen, and the two loads guard each other — see this route's
	 * `+page.ts`. What that split retired here is a page written as two screens
	 * with an `{#if}` down the middle, and with it the Start-page bug the merge
	 * had been guarding against: a reroute cannot lie about a session now that
	 * the holder is refilled from the snapshot before any page load runs.
	 */
	let { data }: PageProps = $props();

	/**
	 * The holder's session, not this page's: it has to outlive the page so
	 * walking to Exercises mid-workout and back lands in the same workout — and
	 * so the nav bars can read the same object for the live dot.
	 *
	 * The load has already refused this address without one, so the null branch
	 * below is not a posture — it is the half-frame between FINISH emptying the
	 * holder and the navigation it starts landing on the idle screen.
	 */
	const session = $derived(activeWorkout.session);

	/**
	 * Bring the live editor back inside the pane, if it is not already fully on
	 * screen. For the state-changing paths the block's own effect does this;
	 * this one exists for the changes no effect sees — a jump to the set that
	 * is already active, and a drag that moved the active exercise after the
	 * lift-time scroll had already answered. `tick` first, so the measurement
	 * is of the layout the change just produced.
	 */
	async function revealActive() {
		await tick();

		const holder = document.querySelector('[data-active-set]');

		if (holder instanceof HTMLElement) {
			revealNearest(holder);
		}
	}

	function jumpTo(setId: string) {
		activeWorkout.session?.select(setId);
		void revealActive();
	}

	/**
	 * Persistence, as a side effect of existing: `$state.snapshot` reads every
	 * leaf of the tree synchronously, so this effect tracks all of them and
	 * re-runs on any mutation — a committed set, a reorder, a removal. The
	 * write is fire-and-forget; the screen never waits on IndexedDB, per the
	 * loop rule.
	 *
	 * A session that holds nothing is not saved — cleared, even: "in progress"
	 * is a claim the bars and the boot resume repeat, and an empty tree left by
	 * a tap on Start-empty and a change of mind should not survive a reload to
	 * make it. The clear also retires any such snapshot written before this
	 * rule existed.
	 */
	$effect(() => {
		if (session === null) {
			return;
		}

		const workout = $state.snapshot(session.workout);

		if (workout.entries.length === 0) {
			void data.store.clearSnapshot();

			return;
		}

		void data.store.saveSnapshot({ workout, activeSetId: session.activeSetId });
	});

	/**
	 * No ceremony, one decision: a session with logged sets becomes a record,
	 * a session with none is discarded — nothing was lifted, and an empty
	 * workout in history would hint nothing and count nothing. Either way the
	 * snapshot is cleared, sync is nudged if an account exists, and the idle
	 * screen is where it lands, one tap from a second run.
	 *
	 * The order is load-bearing at the end: the snapshot goes, then the holder,
	 * then the cached answers about it, then the navigation. `/workout` bounces
	 * anything back here while any of the three still says a workout is running,
	 * so emptying them in that order is what makes the last line an arrival
	 * rather than a round trip. The invalidation is not belt-and-braces — the
	 * hover-preloader had already asked and been told yes; `SESSION_DEP` has it.
	 */
	async function finishSession() {
		if (session === null) {
			return;
		}

		if (session.hasLoggedSets) {
			await data.store.finishWorkout($state.snapshot(session.workout), Date.now());
		}

		await data.store.clearSnapshot();

		if (data.user) {
			syncSoon(data.user.id);
		}

		activeWorkout.finish();

		await invalidate(SESSION_DEP);
		await goto('/workout');
	}

	const groups = $derived(session === null ? [] : groupsWithMeta(session.workout, catalogById));

	/**
	 * The pane's answer to a drag happening somewhere else.
	 *
	 * Reordering is performed on the session list — the rail beside this pane
	 * from `lg`, the sheet below it — and the pane behind was rewriting itself
	 * between frames: two blocks swapped with nothing to say they had, so the
	 * session you were reading was suddenly in a different order and the only
	 * way to be sure what had moved was to go and look. Sliding them is the
	 * whole fix; it costs one wrapper element, since `animate:` goes on an
	 * element of a keyed block and `ExerciseBlock` is a component.
	 *
	 * The rail's own duration, because it is the same gesture seen twice and two
	 * speeds would read as two events. Off entirely under reduced motion: unlike
	 * the row following the finger, nothing here is being touched.
	 */
	const slide = $derived(prefersReducedMotion.current ? 0 : 200);

	let overview = $state(false);

	/**
	 * A swipe rightward across the pane opens the overview drawer — the drawer
	 * arrives from the left, so the gesture pulls it in from the side it lives
	 * on. Anywhere on the pane, not the screen's left edge: Android's gesture
	 * navigation owns edge swipes as back, and an edge-only gesture would be
	 * mostly dead on the phones this exists for.
	 *
	 * Observation only — no capture, no preventDefault — so nothing the pane
	 * already answers is taxed: a vertical wander past a horizontal one is a
	 * scroll and abandons the read, and the whole travel must land inside
	 * 400ms, safely under the 500ms after which a still-ish press on a set row
	 * is a long-press opening options. The horizontal-dominance test (twice the
	 * drift) is what keeps a sloppy scroll from opening a panel nobody asked
	 * for. Nothing here is `$state`: read and written in handlers, rendered by
	 * none.
	 */
	// `lg` written out, the same way `viewport.ts` writes `sm` out and for the
	// same reason: from `lg` the rail is permanently open and the gesture would
	// be pulling at a drawer that does not exist.
	const railed = new MediaQuery('min-width: 64rem', false);

	let swipe: { x: number; y: number; at: number } | null = null;

	function swipeStart(event: PointerEvent) {
		if (railed.current || !event.isPrimary) {
			swipe = null;
			return;
		}

		swipe = { x: event.clientX, y: event.clientY, at: performance.now() };
	}

	function swipeMove(event: PointerEvent) {
		if (swipe === null) {
			return;
		}

		if (performance.now() - swipe.at > 400) {
			swipe = null;
			return;
		}

		const dx = event.clientX - swipe.x;
		const dy = Math.abs(event.clientY - swipe.y);

		if (dy > 24 && dy > dx) {
			swipe = null;
			return;
		}

		if (dx > 48 && dx > 2 * dy) {
			swipe = null;
			overview = true;
		}
	}

	function swipeEnd() {
		swipe = null;
	}

	// One insert sheet for the screen, reached from the rail and from the
	// overview alike — the overview closes itself first, so the two are never
	// open at once.
	let insertOpen = $state(false);

	/**
	 * The exercise-level sheet, and the picker a swap opens behind it.
	 *
	 * Addressed by entry id and resolved out of the live tree on every read, for
	 * the same reason the set sheet is: a swap rebuilds the entry underneath, and
	 * a group snapshotted on open would have the sheet naming the exercise that
	 * has just left.
	 *
	 * `swapping` outlives the options sheet on purpose — it is what the picker's
	 * answer is applied to, and the options sheet has closed by then.
	 */
	let exerciseOpen = $state(false);
	let swapOpen = $state(false);
	let swapping = $state<string | null>(null);

	const exerciseGroup = $derived(groups.find((g) => g.entryId === swapping) ?? null);

	function exerciseOptions(entryId: string) {
		swapping = entryId;
		exerciseOpen = true;
	}

	function swapPick(exerciseId: string) {
		if (session === null || swapping === null) {
			return;
		}

		session.swapExercise(swapping, exerciseId);
		swapping = null;
	}

	function removeExercise() {
		if (session === null || swapping === null) {
			return;
		}

		session.removeExercise(swapping);
		swapping = null;
	}

	// Finish asks first, from either header and from the button under the
	// session. PRODUCT.md gives finishing no ceremony, and this is not one: it is
	// the single confirm the app grants an action that cannot be undone, the same
	// one a logged set gets before it is removed.
	let finishing = $state(false);

	const owed = $derived(
		groups.flatMap((group) => group.cursors).filter((cursor) => !cursor.set.completed).length
	);

	const owedLabel = $derived(
		owed === 0
			? 'Every set is logged.'
			: `${owed} set${owed === 1 ? '' : 's'} still owed. The session ends as it stands.`
	);

	/**
	 * The set-options sheet is one instance for the screen, addressed by id.
	 *
	 * Resolved out of the live tree on every read rather than captured when the
	 * sheet opens: removing a set renumbers the ones below it, and a cursor
	 * snapshotted on open would have the sheet describing a row that has moved.
	 */
	let optionsOpen = $state(false);
	let optionsSetId = $state<string | null>(null);

	const optionsGroup = $derived(
		groups.find((g) => g.cursors.some((c) => c.set.id === optionsSetId)) ?? null
	);

	const optionsCursor = $derived(
		optionsGroup === null
			? null
			: (optionsGroup.cursors.find((c) => c.set.id === optionsSetId) ?? null)
	);

	function options(setId: string) {
		optionsSetId = setId;
		optionsOpen = true;
	}

	function removeSet() {
		if (session === null || optionsSetId === null) {
			return;
		}

		session.removeSet(optionsSetId);
		optionsSetId = null;
	}

	// The bar's right-hand slot, given back on the way out — leaving it set would
	// carry FINISH onto Exercises, which is a button that resets a workout
	// sitting on a screen that has none. The idle screen fills the same slot with
	// the gear, and neither page has to know that: one address, one action.
	const bar = appBarSlot();

	$effect(() => {
		bar.action = finish;

		return () => {
			bar.action = null;
		};
	});
</script>

<!-- Declared once and rendered twice — into this screen's own header on a phone,
     and into the app bar's slot on a desk. Finish has no ceremony: no summary,
     no confetti, one question and out. What follows the question is
     `finishSession` — the session recorded or discarded, and the idle screen,
     where a second run is one tap away. -->
{#snippet finish()}
	<Button variant="chrome" caps onclick={() => (finishing = true)}>FINISH</Button>
{/snippet}

<svelte:head>
	<title>Workout | Kilorep</title>
</svelte:head>

<!-- Rendered only while the holder has one, and the load has already refused
     this address without one — so this is not the idle posture returning by
     another name. It is the half-frame after FINISH empties the holder and
     before the navigation it starts lands, and a pane drawn from a session
     that no longer exists is worse than a pane briefly drawn from nothing. -->
{#if session !== null}
	<div class="flex min-h-0 flex-1 flex-col">
		<header class="shrink-0 border-b border-line-soft bg-surface pt-safe-t lg:hidden">
			<div class="flex items-center gap-2 px-3 py-2">
				<button
					type="button"
					aria-label="Session overview"
					onclick={() => (overview = true)}
					class="grid min-h-chrome w-11 shrink-0 place-items-center rounded-full border
					border-line text-ink-muted focus-ring hover:bg-surface-2 active:bg-surface-2"
				>
					<Stack size={20} />
				</button>

				<div class="min-w-0 flex-1 text-center">
					<span class="label-caps">Workout</span>
				</div>

				{@render finish()}
			</div>
		</header>

		<!-- The swipe listeners ride the pane's wrapper — every set row, every gap —
		     because the gesture belongs to the screen, not to a strip of it. See
		     `swipeStart` for why they observe rather than claim the pointer. The
		     a11y ignore is honest: this is not an interaction, it is a shortcut to
		     the header's own Session-overview button, which keyboards and screen
		     readers already have. -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="relative flex min-h-0 flex-1"
			onpointerdown={swipeStart}
			onpointermove={swipeMove}
			onpointerup={swipeEnd}
			onpointercancel={swipeEnd}
		>
			<!-- The session list, floating in the margin the window has left over.
		     Taken out of the flow on purpose: the pane below is the full width of
		     the window and scrolls at its edge exactly as every other screen does,
		     which is the whole reason the set rows land on the same pixel here as
		     they do on Exercises. A rail with a width would move them, and used to.

		     The card hangs from its *right* edge, which never moves: half the
		     window, back the 288px half-cap of the column, back 16px of air.
		     19rem is those two added up, and `right` is the window's other half
		     plus that. Growth happens leftward, into margin nothing else uses.

		     The width is the whole margin, clamped. The floor is the 208px that
		     makes 576 + 2 × (208 + 16) = 1024 exactly — the rail fits flush the
		     moment `lg` puts the top bar up, no laptop left with the bar but not
		     the rail, see `app.css`. From there every pixel the window grows goes
		     straight to the card (19.75rem is the right offset plus 12px of air
		     kept off the window's edge), because 208px truncates half the catalog
		     — Incline Dumbbell Press has never once fitted in it. The ceiling is
		     320px, past which a wider card is no more legible and a huge monitor
		     would be drawing a sidebar rather than a card; beyond ~1272px the
		     card simply floats mid-margin.

		     `inset-y-0` is the pane's height and nothing more, so `max-h-full` on
		     the card is exact — a session longer than the window scrolls inside the
		     card rather than off the bottom of it. It is a card and not a pane: the
		     height of what is in it, no edge borrowed from the window, and no
		     shadow, which in this app means something has left the page. -->
			<aside
				class="absolute inset-y-0 right-[calc(50%+19rem)] hidden
					w-[clamp(13rem,50%_-_19.75rem,20rem)] py-3 lg:block"
			>
				<div class="max-h-full overflow-y-auto rounded-xl border border-line-soft bg-surface p-2">
					<SessionList
						{groups}
						activeSetId={session.activeSetId}
						onjump={jumpTo}
						onfocus={(id) => session.select(id)}
						oninsert={() => (insertOpen = true)}
						onreorder={(entryId, index) => session.moveEntry(entryId, index)}
						ondrop={() => void revealActive()}
					/>
				</div>
			</aside>

			<!-- `max(…)` and not `pb-safe-b` alone: on the many devices whose inset
		     is zero the bare token put FINISH flush against the screen's edge,
		     and the floor of a page deserves the air the drawers already claim
		     the same way. -->
			<main class="min-h-0 flex-1 overflow-y-auto py-3 pb-[max(1.5rem,var(--spacing-safe-b))]">
				<!-- Capped and centred in the window, which is where the bar centres
			     its tabs — so the tabs land over the set rows, and Exercises'
			     column lands under them too. The mark and FINISH pin to the
			     window's edges instead; the bar explains the split.

			     The gutter goes inside the cap, never on the pane around it: the
			     bar puts its own there too, and padding on opposite sides of the
			     same cap is how the two columns end up 12px out of true. -->
				<!-- `min-h-full` only while the session is empty: it hands EmptyState
			     the height to centre in, and with blocks on screen it would let
			     the finished-state's flex-1 shove FINISH to the pane's floor. -->
				<div
					class={['column-content flex flex-col gap-7 px-3', groups.length === 0 && 'min-h-full']}
				>
					{#each groups as group (group.id)}
						<div animate:flip={{ duration: slide }}>
							<ExerciseBlock
								meta={group.meta}
								cursors={group.cursors}
								history={data.history}
								activeSetId={session.activeSetId}
								oncommit={(w, r) => session.commit(w, r)}
								ondraft={(id, w, r) => session.draft(id, w, r)}
								onselect={(id) => session.select(id)}
								onadd={() => session.addSet(group.cursors[0].exercise.id)}
								oninsert={() => (insertOpen = true)}
								onoptions={options}
								onexercise={() => exerciseOptions(group.entryId)}
							/>
						</div>
					{/each}

					<!-- The empty session: with no templates yet, every workout begins as
				     nothing, and the insert sheet is how everything arrives. It is also
				     where a session lands when its last exercise is removed, which is
				     the same state and needs no second wording. -->
					{#if groups.length === 0}
						<EmptyState title="Empty session" description="Add an exercise to start logging.">
							{#snippet icon()}
								<Stack size={24} />
							{/snippet}
							{#snippet action()}
								<Button variant="commit" onclick={() => (insertOpen = true)}>Add exercise</Button>
							{/snippet}
						</EmptyState>
					{:else}
						<!-- Under the session rather than instead of it. Every block keeps its
					     add-set row while this is on screen, which is the only way a set
					     added after the last one was logged is reachable at all — and the
					     workout you just finished is still there to look at.

					     It carries no button of its own any more: Finish is below, always,
					     and two of them stacked would be the screen asking twice. -->
						<!-- Add-exercise, meanwhile, rides every block's add-set row as the
					     narrow second segment: the rail from `lg` and the overview sheet
					     below it still carry the act, but a full-width row of its own at
					     the pane's foot was retired once for crowding the end of the
					     session, and the segment is how the pane gets the act back
					     without asking for that spot again. -->
						{#if session.finished}
							<EmptyState title="Every set logged" description="Nothing left in this session.">
								{#snippet icon()}
									<Check size={24} />
								{/snippet}
							</EmptyState>
						{/if}

						<!-- The end of the session, where a session ends, and now the only
					     control under the blocks. The `+ Add exercise` that used to sit
					     above it is gone: the rail carries one from `lg`, the overview
					     sheet carries one below that and the sheet is a tap from the
					     header, so the pane was the third copy of an act nobody performs
					     mid-set. What it cost was the two things at the bottom of a
					     session both being buttons, one of them dashed, the other quiet,
					     neither obviously the end.

					     The header keeps its FINISH for the thumb that never scrolls down
					     here; this is for the one that has just logged the last set and is
					     already looking at the bottom of the page. Same word in the same
					     dress either way — `Button`'s caps size follows the box, so the
					     header's 13px and this button's are the same label at two scales
					     rather than two different labels.

					     Always filled, the standing exception to `Button`'s one-filled-
					     button rule — the end of a session is a commit wherever the
					     session stands. Compact while sets are owed, so `Log set` keeps
					     the gym scale to itself; the full slab arrives when nothing is
					     left, which is the same size change the button already made and
					     the moment it stops competing with anything. -->
						<Button
							variant="commit"
							compact={!session.finished}
							caps
							class="w-full"
							onclick={() => (finishing = true)}
						>
							FINISH
						</Button>
					{/if}
				</div>
			</main>
		</div>
	</div>

	<OverviewDrawer
		bind:open={overview}
		{groups}
		activeSetId={session.activeSetId}
		onjump={jumpTo}
		oninsert={() => (insertOpen = true)}
		onreorder={(entryId, index) => session.moveEntry(entryId, index)}
		ondrop={() => void revealActive()}
	/>

	<!-- `multiple`, because this sheet is how an empty session becomes a session:
	     checking off a day's movements and committing once beats reopening the
	     panel per exercise, and mid-session the same bar costs a tap nobody
	     making a single insert would notice. The cursor lands on the first of
	     what arrives — see `addExercises`. -->
	<ExercisePickerSheet
		bind:open={insertOpen}
		title="Add exercise"
		multiple
		frequent={data.frequent}
		lastPerformed={data.lastPerformed}
		onpick={(ids) => session.addExercises(ids)}
	/>

	<!-- The same picker, asking a different question. It opens as the options sheet
     closes, the way the overview already hands over to the insert.

     `replacing` is what makes it a different question rather than the same list
     under another title: the sheet shelves substitutes for this exercise above
     the muscle sections. It resolves out of the live tree like everything else
     addressed by `swapping`, and is null once the entry is gone — the sheet has
     closed by then, and a Similar list for an exercise that has left the session
     would be describing nothing. -->
	<ExercisePickerSheet
		bind:open={swapOpen}
		title="Swap exercise"
		replacing={exerciseGroup === null ? null : exerciseGroup.meta}
		lastPerformed={data.lastPerformed}
		onpick={([id]) => swapPick(id)}
	/>

	<ExerciseOptionsSheet
		bind:open={exerciseOpen}
		group={exerciseGroup}
		onswap={() => (swapOpen = true)}
		onremove={removeExercise}
	/>

	<SetOptionsSheet
		bind:open={optionsOpen}
		cursor={optionsCursor}
		removable={optionsGroup !== null && optionsGroup.cursors.length > 1}
		onremove={removeSet}
	/>

	<AlertDialog
		bind:open={finishing}
		title="Finish workout?"
		description={owedLabel}
		confirmLabel="Finish"
		onconfirm={() => void finishSession()}
	/>
{/if}
