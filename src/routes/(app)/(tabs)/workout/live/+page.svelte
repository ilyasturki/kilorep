<script lang="ts">
	import { tick } from 'svelte';
	import { flip } from 'svelte/animate';
	import { MediaQuery } from 'svelte/reactivity';
	import { goto, invalidate } from '$app/navigation';

	import { catalogById } from '$lib/catalog';
	import { fillAppBar } from '$lib/nav/bar.svelte';
	import { syncSoon } from '$lib/sync/client';
	import { entriesWithMeta, entryOf, legOf, shelfOf } from '$lib/workout/groups';
	import { activeWorkout, SESSION_DEP } from '$lib/workout/active.svelte';
	import EntryStack from '$lib/workout/EntryStack.svelte';
	import ExerciseBlock from '$lib/workout/ExerciseBlock.svelte';
	import ExerciseOptionsMenu from '$lib/workout/ExerciseOptionsMenu.svelte';
	import ExercisePickerSheet from '$lib/workout/ExercisePickerSheet.svelte';
	import OverviewDrawer from '$lib/workout/OverviewDrawer.svelte';
	import OverviewPeek from '$lib/workout/OverviewPeek.svelte';
	import SessionList from '$lib/workout/SessionList.svelte';
	import SetOptionsMenu from '$lib/workout/SetOptionsMenu.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import { playMorphs } from '$lib/ui/morph';
	import { quickMs } from '$lib/ui/motion';
	import { coarsePointer } from '$lib/ui/pointer';
	import { fullyVisible, revealNearest, revealSpan, revealStart } from '$lib/ui/scroll';
	import Stack from '$lib/ui/icons/Stack.svelte';
	import { press, SLOP } from '$lib/ui/press';

	import type { PageProps } from './$types';

	/**
	 * The workout screen: the whole session stacked, the active set expanded in
	 * place inside it.
	 *
	 * PRODUCT.md left focused-one-exercise-at-a-time and full-session-list open,
	 * and both shipped here behind `?mode=` so a run through the fixture could
	 * decide it. The list won; the fork, the focused branch and its transition
	 * are gone. What the list costs is one thing, and it stays: this screen pulls
	 * the active set back inside the pane after a commit, because in a stacked
	 * session it otherwise marches off the bottom of the page. See `settle`.
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
	 * Where the pane goes when the cursor moves, and the one place that decides
	 * it. `ExerciseBlock` used to own this and could only ever see its own set —
	 * which is why the exercise's name never came with it.
	 *
	 * Two arrivals, because the screen is answering two different acts:
	 *
	 * A **jump** is a destination named out loud: a tap in the session list or
	 * the overview, an exercise lifted on the rail, a set added by the insert
	 * sheet. The title goes to the top of the pane and the set comes with it if
	 * it fits, because what was asked for is the exercise, not the row — and a
	 * named destination should land in the same place every time it is named.
	 * The one thing that stops it is the pane already showing both: tapping an
	 * exercise you are looking at should not move the page under you.
	 *
	 * An **advance** is the loop moving by itself — a set logged, a set added at
	 * the foot of a block, the screen mounting on the way back from another tab.
	 * Here the title is a courtesy and the set is the point, so the pane travels
	 * the shortfall and no further, and drops the header the moment the two stop
	 * fitting together. Mid-session that is the difference between a page that
	 * nudges and a page that relocates.
	 *
	 * Both travel on the screen's one duration and curve; see `motion.ts`.
	 */
	let intent: 'jump' | 'advance' = 'advance';
	let scheduled = false;

	/**
	 * Where the pane has to be, measured and started. Called once per change by
	 * `settle`, which is the only thing that knows the layout has settled.
	 */
	function reveal() {
		const mode = intent;
		intent = 'advance';

		const holder = document.querySelector('[data-active-set]');

		if (!(holder instanceof HTMLElement)) {
			return;
		}

		const head = holder.closest('[data-exercise]')?.querySelector('[data-exercise-head]');

		if (!(head instanceof HTMLElement)) {
			revealNearest(holder);

			return;
		}

		if (mode === 'advance') {
			revealSpan(head, holder);

			return;
		}

		if (fullyVisible(head) && fullyVisible(holder)) {
			return;
		}

		revealStart(head);
	}

	/**
	 * One reveal per change, whoever asked for it.
	 *
	 * The effect below catches every move of the cursor, and the jump paths call
	 * in by hand as well — because a jump to the set that is already active
	 * changes nothing for an effect to see. Both land here, the first one through
	 * books the pass and the second is swallowed, and `intent` is read after the
	 * wait rather than at the door, so it does not matter which of them arrived
	 * first. `tick` is what makes the measurement one of the layout the change
	 * just produced instead of the one it replaced.
	 *
	 * The two calls are in this order for one reason, and it is the whole reason
	 * this screen owns them rather than each block playing its own: `reveal`
	 * measures, and what it has to measure is the layout the swap settled on —
	 * the editor at editor height, the row it replaced already one line tall.
	 * `playMorphs` then takes those same boxes back to the heights they had and
	 * lets them travel forward, so the pane is aiming at where everything ends up
	 * while the cards are still on their way there. Both happen inside this
	 * microtask, before the browser has painted either, so nothing is ever seen
	 * at the height it is about to animate from.
	 */
	async function settle() {
		if (scheduled) {
			return;
		}

		scheduled = true;
		await tick();
		scheduled = false;

		reveal();
		playMorphs();
	}

	/** Mark the reveal this change earns a jump, and make sure one happens. */
	function jumped() {
		intent = 'jump';
		void settle();
	}

	function jumpTo(setId: string) {
		activeWorkout.session?.select(setId);
		jumped();
	}

	/**
	 * The cursor moved, so the pane follows. Reading `activeSetId` in the guard
	 * is what subscribes to it; a session with none is a finished one, and there
	 * is nothing left on screen to reveal.
	 */
	$effect(() => {
		if (session === null || session.activeSetId === null) {
			return;
		}

		void settle();
	});

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

	/**
	 * The pane stacks entries, not exercises. A superset is one entry with two
	 * legs — bracketed together below, lifted a round at a time — so the entry is
	 * both the unit that is drawn and the unit `animate:flip` slides when a drag
	 * on the rail reorders the session. Iterating legs would slide the halves of
	 * a pair independently, which is two events where the user made one.
	 */
	const entries = $derived(session === null ? [] : entriesWithMeta(session.workout, catalogById));

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
	 * The screen's own duration, because it is the same gesture seen twice and two
	 * speeds would read as two events. Off entirely under reduced motion: unlike
	 * the row following the finger, nothing here is being touched.
	 */
	const slide = $derived(quickMs());

	let overview = $state(false);
	let instant = $state(false);

	/**
	 * A swipe rightward across the pane pulls the overview panel in — the drawer
	 * lives on the left, so the gesture drags it out from the side it lives on.
	 * Anywhere on the pane, not the screen's left edge: Android's gesture
	 * navigation owns edge swipes as back, and an edge-only gesture would be
	 * mostly dead on the phones this exists for.
	 *
	 * The panel follows the finger. It used to snap open once the swipe passed
	 * 48px inside 400ms, which meant the gesture had a verdict but no picture of
	 * itself — nothing on screen moved until everything had. Now the travel *is*
	 * the panel's position, so a swipe that changes its mind halfway can be taken
	 * back, and the deadline is gone with it: a drag that follows the finger has
	 * nothing to time out.
	 *
	 * Two stages, and the first is deliberately unclaimed. Before the pane knows
	 * this is horizontal it only watches — no capture, no `preventDefault` — so
	 * nothing the pane already answers is taxed and a vertical wander is still a
	 * scroll. Committing takes the pointer, and that is what tells everything
	 * underneath the gesture stopped being theirs: `press` cancels on
	 * `lostpointercapture`, so the set row the finger started on gives up its
	 * press rather than lighting up behind a moving panel.
	 */
	// `lg` written out, the same way `viewport.ts` writes `sm` out and for the
	// same reason: from `lg` the rail is permanently open and the gesture would
	// be pulling at a drawer that does not exist.
	const railed = new MediaQuery('min-width: 64rem', false);

	/**
	 * The live drag: pointer, where it started, and where it was last seen with
	 * when, which is what makes a flick measurable. Not `$state` — it is read and
	 * written in handlers and rendered by nothing; what the panel renders from is
	 * `peek`.
	 */
	let drag: { id: number; x0: number; y0: number; x: number; at: number; v: number } | null = null;

	/**
	 * How far the panel is out, in pixels, or null for no panel at all. `settling`
	 * is the release: the same offset animated to one end or the other.
	 */
	let peek = $state<number | null>(null);
	let peekWidth = $state(0);
	let settling = $state(false);

	/**
	 * A drag that ends over a set row still ends in a click, and that click would
	 * select the set the finger happened to be resting on. Swallowed at the pane,
	 * in the capture phase, which beats both the row's own delegated handler and
	 * `press`'s — see `press.ts` for why a listener on the element wins against
	 * Svelte's root delegation.
	 */
	let swallow = false;

	/** Past this much of the panel, the release opens it; short of it, it goes back. */
	const SETTLE_AT = 0.4;

	/** px per ms of rightward flick that opens the panel from anywhere. */
	const FLING = 0.5;

	function swipeStart(event: PointerEvent) {
		swallow = false;

		if (railed.current || !coarsePointer || !event.isPrimary || overview || peek !== null) {
			drag = null;
			return;
		}

		drag = {
			id: event.pointerId,
			x0: event.clientX,
			y0: event.clientY,
			x: event.clientX,
			at: event.timeStamp,
			v: 0
		};
	}

	// The pane itself, typed in, because committing the gesture takes the pointer
	// and `PointerEvent` alone knows nothing about what it was dispatched on.
	function swipeMove(event: PointerEvent & { currentTarget: HTMLElement }) {
		if (drag === null || event.pointerId !== drag.id) {
			return;
		}

		const span = event.timeStamp - drag.at;

		if (span > 0) {
			drag.v = (event.clientX - drag.x) / span;
			drag.x = event.clientX;
			drag.at = event.timeStamp;
		}

		const dx = event.clientX - drag.x0;
		const dy = Math.abs(event.clientY - drag.y0);

		if (peek !== null) {
			peek = Math.max(0, Math.min(dx, peekWidth));
			return;
		}

		// The same 12px `press` treats as the end of a press, so the two agree on
		// the moment a touch stopped being a tap. Dominance — twice the drift —
		// is what keeps a sloppy scroll from dragging a panel nobody asked for.
		if (dy > SLOP && dy > dx) {
			drag = null;
			return;
		}

		if (dx > SLOP && dx > 2 * dy) {
			event.currentTarget.setPointerCapture(drag.id);
			peek = dx;
		}
	}

	/**
	 * The handover, or the retreat.
	 *
	 * Opening hands the real drawer a panel already at rest — `instant` is what
	 * keeps vaul from sliding it in again — and the stand-in is dropped a frame
	 * later rather than in the same breath, so the two are painted over each
	 * other once instead of leaving a single frame of bare pane between them.
	 */
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
		if (drag === null || peek === null) {
			drag = null;
			return;
		}

		const opened = peek >= peekWidth * SETTLE_AT || drag.v > FLING;
		const target = opened ? peekWidth : 0;

		drag = null;
		swallow = true;

		// Nothing to animate — released at rest, or an OS that has asked for no
		// motion — so the handover is now. `transitionend` is the only thing that
		// reports a settle finishing, and it does not fire for a transition that
		// had nothing to do.
		if (target === peek || quickMs() === 0) {
			peek = target;
			settled();
			return;
		}

		settling = true;
		peek = target;
	}

	// Whatever closed it, the next opening is the ordinary one and arrives on
	// vaul's own curve.
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

	/**
	 * One insert sheet for the screen, reached from three doors: a block's own
	 * add row, the rail and the overview, and the empty session's button. The
	 * overview closes itself first, so no two are ever open at once.
	 *
	 * `insertAfter` is which door, in the only form the domain cares about — the
	 * entry the picks land behind, or null for the end. A block's add row names
	 * its entry because the tap said where. The rail and the empty state name
	 * nothing: the rail's add row stands at the foot of the session list and the
	 * empty session has nothing to follow, so the end is what both of them
	 * already promise by where they sit.
	 *
	 * Set by the door on the way in rather than read back on the way out, so the
	 * two ways of asking cannot both be live at once. It is cleared when the
	 * picks are applied, not when the sheet closes: a dismissed sheet leaves it
	 * standing, and the next door overwrites it before the sheet reopens.
	 */
	let insertOpen = $state(false);
	let insertAfter = $state<string | null>(null);

	function insertFrom(entryId: string | null) {
		insertAfter = entryId;
		insertOpen = true;
	}

	function insertPicks(exerciseIds: string[]) {
		session?.addExercises(exerciseIds, insertAfter ?? undefined);
		insertAfter = null;

		// A jump: the picks are a destination the user just named, and the first
		// of them is what the cursor has moved to — so the pane arrives on its
		// title the same way a tap in the session list does.
		jumped();
	}

	/**
	 * The exercise-level sheet, and the two pickers that open behind it.
	 *
	 * Addressed by the exercise *node* id, and resolved out of the live tree on
	 * every read for the same reason the set sheet is: a swap rebuilds the node
	 * underneath, and a group snapshotted on open would have the sheet naming an
	 * exercise that has just left.
	 *
	 * The node and not the entry, because an entry can hold two of them now: Swap
	 * and Remove act on the leg whose ⋯ was tapped, while Superset and Break act
	 * on the entry it stands in — which is why both are derived here rather than
	 * one being passed around.
	 *
	 * `acting` outlives the options sheet on purpose — it is what a picker's
	 * answer is applied to, and the options sheet has closed by then.
	 */
	let exerciseOpen = $state(false);
	let swapOpen = $state(false);
	let supersetOpen = $state(false);
	let acting = $state<string | null>(null);

	const actingLeg = $derived(legOf(entries, acting));
	const actingEntry = $derived(entryOf(entries, acting));

	/** Everything else in the session, pinned above the catalog — see `shelfOf`. */
	const supersetShelf = $derived(
		actingEntry === null ? null : shelfOf(entries, actingEntry.id, 'In this session')
	);

	let exerciseAnchor = $state<HTMLElement | null>(null);

	function exerciseOptions(exerciseId: string, anchor: HTMLElement) {
		acting = exerciseId;
		exerciseAnchor = anchor;
		exerciseOpen = true;
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

	// Finish asks first, from either header and from the button under the
	// session. PRODUCT.md gives finishing no ceremony, and this is not one: it is
	// the single confirm the app grants an action that cannot be undone, the same
	// one a logged set gets before it is removed.
	let finishing = $state(false);

	const owed = $derived(
		entries.flatMap((entry) => entry.cursors).filter((cursor) => !cursor.set.completed).length
	);

	const owedLabel = $derived(
		owed === 0
			? 'Every set is logged.'
			: `${owed} set${owed === 1 ? '' : 's'} still owed. The session ends as it stands.`
	);

	/**
	 * The set-options menu is one instance for the screen, addressed by id.
	 *
	 * Resolved out of the live tree on every read rather than captured when the
	 * menu opens: removing a set renumbers the ones below it, and a cursor
	 * snapshotted on open would have the menu describing a row that has moved.
	 * The anchor is the one thing that *is* captured — the ⋯ that was clicked
	 * is where the desktop menu hangs, and it does not move while it is open.
	 */
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

	function unlogSet() {
		if (session === null || optionsSetId === null) {
			return;
		}

		session.unlogSet(optionsSetId);
		optionsSetId = null;
	}

	function removeSet() {
		if (session === null || optionsSetId === null) {
			return;
		}

		session.removeSet(optionsSetId);
		optionsSetId = null;
	}

	/**
	 * What the bar carries while a session runs, given back on the way out —
	 * leaving any of it set would put FINISH on a screen with no workout to
	 * finish.
	 *
	 * The leading slot is the session overview rather than a back button, which
	 * is the whole reason that slot exists: this address is a tab root, so the
	 * bar would otherwise draw nothing there, and the overview is what a thumb
	 * reaches for mid-session. FINISH keeps the right-hand slot on both
	 * viewports — the thumb that never scrolls still finds it without leaving
	 * the top of the screen, which is rule 7's whole claim on this bar.
	 */
	fillAppBar(() => ({ title: 'Workout', leading: overviewButton, action: finish }));
</script>

{#snippet overviewButton()}
	<button
		type="button"
		aria-label="Session overview"
		onclick={() => (overview = true)}
		class="grid min-h-chrome w-11 shrink-0 place-items-center rounded-full border
			border-line text-ink-muted focus-ring hover:bg-hover press:bg-surface-2"
		{@attach press()}
	>
		<Stack size={20} />
	</button>
{/snippet}

<!-- Finish has no ceremony: no summary, no confetti, one question and out. What
     follows the question is `finishSession` — the session recorded or discarded,
     and the idle screen, where a second run is one tap away. -->
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
		<!-- The swipe listeners ride the pane's wrapper — every set row, every gap —
		     because the gesture belongs to the screen, not to a strip of it. See
		     `swipeStart` for why they watch before they claim the pointer, and
		     `swipeClick` for why the pane also has to eat one click. The a11y
		     ignore is honest: this is not an interaction, it is a shortcut to the
		     header's own Session-overview button, which keyboards and screen
		     readers already have. -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="relative flex min-h-0 flex-1"
			onpointerdown={swipeStart}
			onpointermove={swipeMove}
			onpointerup={swipeEnd}
			onpointercancel={swipeEnd}
			onclickcapture={swipeClick}
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
						{entries}
						activeSetId={session.activeSetId}
						onjump={jumpTo}
						onfocus={jumpTo}
						oninsert={() => insertFrom(null)}
						onreorder={(entryId, index) => session.moveEntry(entryId, index)}
						ondrop={jumped}
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
			     the height to centre in. With blocks on screen it would stretch the
			     column past its content and leave FINISH stranded at the pane's
			     floor, a scroll below the last set. -->
				<div
					class={['column-content flex flex-col gap-7 px-3', entries.length === 0 && 'min-h-full']}
				>
					{#each entries as entry (entry.id)}
						<!-- The flip wrapper is the entry, so a superset's legs slide
						     together when the rail reorders the session — one gesture, one
						     movement on screen. Inside it the legs keep their own blocks,
						     their own headers and their own ⋯; what says they are one thing
						     is `EntryStack`'s bracket. -->
						<div animate:flip={{ duration: slide }} class="relative flex flex-col gap-5">
							<!-- The seam trades the two legs, here as in the editor: the order
							     planned at a desk is not always the order the floor allows, and
							     a rack already taken is reason enough to lead with the other
							     movement. The cursor does not follow — see
							     `session.moveExercise` for why it must not. -->
							<EntryStack
								legs={entry.legs}
								superset={entry.superset}
								onswap={(leg) => session.moveExercise(leg.id)}
								swapLabel={(leg) => `Move ${leg.meta.name} ahead in the superset`}
							>
								{#snippet leg(leg)}
									<ExerciseBlock
										meta={leg.meta}
										cursors={leg.cursors}
										history={data.history}
										activeSetId={session.activeSetId}
										oncommit={(w, r) => session.commit(w, r)}
										ondraft={(id, w, r) => session.draft(id, w, r)}
										onrate={(id, rpe) => session.rate(id, rpe)}
										onselect={(id) => session.select(id)}
										onadd={() => session.addSet(leg.cursors[0].exercise.id)}
										oninsert={() => insertFrom(entry.id)}
										onoptions={options}
										onexercise={(anchor) => exerciseOptions(leg.id, anchor)}
									/>
								{/snippet}
							</EntryStack>
						</div>
					{/each}

					<!-- The empty session: with no templates yet, every workout begins as
				     nothing, and the insert sheet is how everything arrives. It is also
				     where a session lands when its last exercise is removed, which is
				     the same state and needs no second wording. -->
					{#if entries.length === 0}
						<EmptyState title="Empty session" description="Add an exercise to start logging.">
							{#snippet icon()}
								<Stack size={24} />
							{/snippet}
							{#snippet action()}
								<Button variant="commit" onclick={() => insertFrom(null)}>Add exercise</Button>
							{/snippet}
						</EmptyState>
					{:else}
						<!-- The end of the session, where a session ends, and the only thing
					     under the blocks. The `+ Add exercise` that used to sit above it
					     is gone: the rail carries one from `lg`, the overview sheet carries
					     one below that and the sheet is a tap from the header, so the pane
					     was the third copy of an act nobody performs mid-set. It rides
					     every block's add-set row as the narrow second segment now, which
					     is how the pane keeps the act without asking for this spot again.

					     What also used to sit above it was an EmptyState for the finished
					     session — a 56px check disc, a heading and a line of copy, a
					     screenful — and between the two of them the end of a session said
					     the same thing twice to a user whose next act was the button
					     underneath. The rows are the record: every one of them wears a
					     check, and the button's own change of size is the announcement.

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
					     left, which is the moment it stops competing with anything and,
					     since the EmptyState went, the only signal that the moment came. -->
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
		{instant}
		{entries}
		activeSetId={session.activeSetId}
		onjump={jumpTo}
		oninsert={() => insertFrom(null)}
		onreorder={(entryId, index) => session.moveEntry(entryId, index)}
		ondrop={jumped}
	/>

	<!-- The same panel while the swipe is still deciding, and only then: it exists
	     between the moment the gesture commits and the moment the drawer above
	     takes over from it. -->
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

	<!-- `multiple`, because this sheet is how an empty session becomes a session:
	     checking off a day's movements and committing once beats reopening the
	     panel per exercise, and mid-session the same bar costs a tap nobody
	     making a single insert would notice. The picks land where the door that
	     opened this said — see `insertAfter` — and the cursor goes to the first
	     of them, see `addExercises`. -->
	<ExercisePickerSheet
		bind:open={insertOpen}
		title="Add exercise"
		multiple
		frequent={data.frequent}
		lastPerformed={data.lastPerformed}
		onpick={insertPicks}
	/>

	<!-- The same picker, asking a different question. It opens as the options sheet
     closes, the way the overview already hands over to the insert.

     `replacing` is what makes it a different question rather than the same list
     under another title: the sheet shelves substitutes for this exercise above
     the muscle sections. It resolves out of the live tree like everything else
     addressed by `acting`, and is null once the exercise is gone — the sheet has
     closed by then, and a Similar list for an exercise that has left the session
     would be describing nothing. -->
	<ExercisePickerSheet
		bind:open={swapOpen}
		title="Swap exercise"
		replacing={actingLeg === null ? null : actingLeg.meta}
		lastPerformed={data.lastPerformed}
		onpick={([id]) => swapPick(id)}
	/>

	<!-- The third question, and the reason the sheet takes a `pinned` shelf: what
	     to superset this exercise with. The session's own movements ride above
	     the catalog, because pairing two things already on the list is what the
	     gesture nearly always means — and the catalog is still underneath for the
	     time it does not.

	     `multiple`, so a giant set is built in one pass rather than by reopening
	     the sheet per leg. The verb follows: the commit bar says what it is about
	     to do, and this one is not adding. -->
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
	/>

	<SetOptionsMenu
		bind:open={optionsOpen}
		cursor={optionsCursor}
		anchor={optionsAnchor}
		removable={optionsGroup !== null && optionsGroup.cursors.length > 1}
		onunlog={unlogSet}
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
