<script lang="ts">
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';
	import { goto, invalidate } from '$app/navigation';

	import { catalogById } from '$lib/catalog';
	import {
		addExercise,
		addSet,
		isBlank,
		moveEntry,
		PLANNED_SET_COUNT,
		removeExercise,
		removeSet,
		replaceExercise,
		setExerciseReps,
		setPlannedReps,
		splitEntry,
		startFrom,
		supersetWith
	} from '$lib/domain/template';
	import { firstUncompleted } from '$lib/domain/workout';
	import { appBarSlot } from '$lib/nav/bar.svelte';
	import { syncSoon } from '$lib/sync/client';
	import { plannedEntries } from '$lib/templates/plan';
	import PlanCard from '$lib/templates/PlanCard.svelte';
	import PlanList from '$lib/templates/PlanList.svelte';
	import PlanOptionsMenu from '$lib/templates/PlanOptionsMenu.svelte';
	import { activeWorkout, SESSION_DEP } from '$lib/workout/active.svelte';
	import EntryStack from '$lib/workout/EntryStack.svelte';
	import ExercisePickerSheet from '$lib/workout/ExercisePickerSheet.svelte';
	import { entryOf, legOf, shelfOf } from '$lib/workout/groups';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import { DragOrder, SETTLE } from '$lib/ui/dragOrder.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import { revealNearest } from '$lib/ui/scroll';
	import DotsSixVertical from '$lib/ui/icons/DotsSixVertical.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';
	import { press } from '$lib/ui/press';

	import type { PageProps } from './$types';

	/**
	 * The template editor: the planning surface, and the place a workout starts
	 * from since the tap-to-start rule was retired (see PRODUCT.md's Start
	 * section). Everything here autosaves; there is no Save and no discard,
	 * the same bargain the workout screen strikes with its snapshot.
	 *
	 * The one exception is a template that never says anything: no name, no
	 * exercises. It is never written — so a mis-tapped "New template" backs out
	 * leaving no record, no sync traffic, no "Untitled" rows accumulating on
	 * Start. And an existing template edited back to blank is deleted on the
	 * way out by the same rule: an empty plan in the list is junk whichever
	 * door it came in through.
	 *
	 * The screen borrows the workout's desk layout: from `lg` the plan is a card
	 * floating in the left gutter beside the pane being edited, on the same
	 * pixels and for the same reasons — which is why this route, like `/workout`,
	 * owns its own scroll pane rather than sitting in the `(tabs)` scroll box.
	 * See that layout, and the geometry note on the `<aside>` below.
	 *
	 * Below `lg` there is no sheet holding a second copy of that list. The
	 * workout needs one because its pane is a stack of set editors and the list
	 * is the only place the whole session is legible at once; a plan is already
	 * one short card per exercise, so a drawer over it would list the thing it is
	 * covering. The cards keep their own grips at every width instead.
	 */
	let { data }: PageProps = $props();

	// The page owns the live tree; the load's copy is the starting point. Read
	// once by design — navigating editor-to-editor never happens (every path
	// re-enters through the Templates tab), so the prop never changes under a
	// live page.
	// svelte-ignore state_referenced_locally
	const template = $state(data.template);

	// Initial value by design, like `template` above: whether a record exists
	// is this page's to advance from here on, not the load's.
	// svelte-ignore state_referenced_locally
	let persisted = $state(data.persisted);

	/**
	 * Persistence as a side effect of existing, like the workout page — with
	 * two gates the workout does not need. The first run is mount, not an
	 * edit: skipped, so opening a template never stamps a no-op save (every
	 * save is dirty and syncs). And a still-blank, never-persisted template is
	 * skipped every run — that is the blank-birth rule.
	 */
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

	// The teardown-only shape (no reads in the body, so it never re-runs): a
	// template left blank is deleted on the way out. `persisted` filters the
	// never-written case, where there is nothing to take back.
	$effect(() => () => {
		if (persisted && isBlank($state.snapshot(template))) {
			void data.store.deleteTemplate(template.id, Date.now());
		}
	});

	/**
	 * The pane stacks entries, not exercises: a planned superset is one entry
	 * with two legs, bracketed together below and dragged as one.
	 */
	const entries = $derived(plannedEntries(template, catalogById));

	/** One row per entry, so there is nothing left to deduplicate. */
	const entryIds = $derived(entries.map((entry) => entry.id));

	// Handle-only lift, unlike PlanList's hold-anywhere: these cards are full of
	// controls, and a long-press that lifted the card out from under a rep target
	// being held would fight the very gesture it shares a row with.
	//
	// The cards vary in height — a card with its per-set targets open is twice
	// the one beside it — which is fine: DragOrder measures each row's own height
	// at lift and computes the slots from them, so the thresholds land where the
	// cards actually are.
	/** The sticky Start bar, measured for the drag's `covered` allowance. */
	let startBar = $state<HTMLElement | null>(null);

	const drag = new DragOrder({
		order: () => entryIds,
		move: (id, index) => {
			moveEntry(template, id, index);

			return true;
		},
		// The sticky Start bar lies over the pane's last rows, and with it the
		// strip where the drag's auto-scroll band would sit — unannounced, a
		// card dragged toward it stalls at the bar's top edge instead of
		// scrolling under it.
		covered: () => startBar?.offsetHeight ?? 0
	});

	const slide = $derived(prefersReducedMotion.current ? 0 : 200);

	let insertOpen = $state(false);

	// One helper rather than the expression twice: the plan's two ways to gain an
	// exercise — a fresh entry and a superset leg — must not drift about how many
	// sets one starts with. The history screen's `ids()` for the same reason.
	const setIds = () => Array.from({ length: PLANNED_SET_COUNT }, () => crypto.randomUUID());

	// A list, because the picker answers in lists: a plan is written by checking
	// off a day's movements at once, which is the act this editor exists for.
	// Order preserved — the picks land in the plan in the order they were made.
	function plan(exerciseIds: string[]) {
		for (const exerciseId of exerciseIds) {
			addExercise(template, exerciseId, {
				entry: crypto.randomUUID(),
				exercise: crypto.randomUUID(),
				sets: setIds()
			});
		}
	}

	/** Drop the last set of an exercise — the sets stepper's `−`. */
	function shrink(exerciseId: string) {
		const group = legOf(entries, exerciseId);
		const last = group?.exercise.sets.at(-1);

		if (last !== undefined) {
			removeSet(template, last.id);
		}
	}

	/**
	 * The pane, so a tap in the sidebar can find the card it names.
	 *
	 * Scoped to the pane on purpose: the sidebar's own rows carry the same
	 * `data-drag-id`, and a document-wide lookup would keep finding the row that
	 * was just tapped instead of the card it points at.
	 */
	let pane = $state<HTMLElement | null>(null);

	function jumpTo(entryId: string) {
		const card = pane?.querySelector(`[data-drag-id="${entryId}"]`);

		if (card instanceof HTMLElement) {
			revealNearest(card);
		}
	}

	/**
	 * The exercise-level sheet, and the picker a swap opens behind it. The
	 * workout screen's pair, one tree over — same names, same handover.
	 *
	 * Addressed by the exercise node's id, which is what `PlanCard` is drawn per
	 * and what a swap leaves untouched, and resolved out of the live tree on
	 * every read rather than snapshotted on open: a sheet naming a card that has
	 * since been dragged elsewhere is worse than one naming nothing.
	 *
	 * `acting` outlives the options sheet on purpose — it is what the picker's
	 * answer is applied to, and the options sheet has closed by then. It is not
	 * cleared after a swap: the card is still there, still under the same id, and
	 * the picker's `replacing` reads it to shelve substitutes.
	 *
	 * Removal asks nothing. It used to, back when it was a bare `×` in the card's
	 * header and the plan is genuinely the work — but it is two taps behind a
	 * menu naming the exercise now, and a dialog after that is a third gate on
	 * one decision.
	 */
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

	function swapPick(exerciseId: string) {
		if (acting !== null) {
			replaceExercise(template, acting, exerciseId);
		}
	}

	function removePlanned() {
		if (acting !== null) {
			removeExercise(template, acting);
			acting = null;
		}
	}

	/** Everything else already planned, pinned above the catalog — see `shelfOf`. */
	const supersetShelf = $derived(
		actingEntry === null ? null : shelfOf(entries, actingEntry.id, 'In this plan')
	);

	/**
	 * Pairing. Move-in-or-plan-fresh is `supersetWith`'s rule and lives in the
	 * domain beside the tree it edits; what is left here is the set count a fresh
	 * leg gets and the ids.
	 */
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

		await goto('/templates');
	}

	/**
	 * Copy-on-start, handed over as the snapshot: the workout screen already
	 * resumes from one on entry, so starting a template *is* a resume of a
	 * session nothing has logged yet — no second begin-path to keep honest.
	 * The cursor opens on the first set, minted null for an empty plan.
	 */
	async function launch() {
		activeWorkout.finish();

		const workout = startFrom($state.snapshot(template), Date.now(), () => crypto.randomUUID());
		const first = firstUncompleted(workout);

		await data.store.saveSnapshot({
			workout,
			activeSetId: first === null ? null : first.set.id
		});

		// The holder just changed, so the workout loads' cached answers are stale
		// — including any the hover-preloader took while a session was still
		// live. `active.svelte.ts` has the whole story.
		await invalidate(SESSION_DEP);
		await goto('/workout');
	}

	let discardOpen = $state(false);

	/**
	 * Exactly one workout is active at a time, and this button must not make a
	 * second one silently: a live session, or a snapshot waiting to be resumed
	 * after a reload, may hold logged sets that overwriting would destroy. The
	 * dialog is the only honest gate — this is a planning surface, not the gym
	 * floor, so the in-gym rule has nothing to say about it.
	 */
	async function start() {
		if (activeWorkout.session !== null || (await data.store.loadSnapshot()) !== null) {
			discardOpen = true;

			return;
		}

		await launch();
	}

	/**
	 * What this screen hands the bar.
	 *
	 * The title is the one place in the app where a screen's name is also a
	 * field: the plan is renamed by typing into the pane, so the bar mirrors it
	 * rather than owning it, and a plan that says nothing yet is called what the
	 * document title calls it.
	 *
	 * The action stays a desk affordance and says so in its own markup rather
	 * than by being withheld here — the pane already pins Start under the thumb
	 * and keeps the trash at the plan's foot, and a phone bar repeating both
	 * would put two Starts on one screen.
	 *
	 * `title` is assigned inside the effect so it re-runs as the name is typed;
	 * the snippet re-renders itself, and `persisted` inside it is read where it
	 * is rendered.
	 */
	const bar = appBarSlot();

	$effect(() => {
		bar.title = template.name.trim() === '' ? 'New template' : template.name;
		bar.action = deskActions;

		return () => {
			bar.title = null;
			bar.action = null;
		};
	});
</script>

{#snippet trash(size: number)}
	<button
		type="button"
		aria-label="Delete template"
		onclick={() => (deleteOpen = true)}
		class="grid min-h-chrome w-11 shrink-0 place-items-center rounded-full border border-line
			text-danger focus-ring hover:bg-hover press:bg-surface-2"
		{@attach press()}
	>
		<Trash {size} />
	</button>
{/snippet}

<!-- START, not "Start workout": the same word the pane's button says, in the
     register a 44px pill can carry — `Button`'s caps size follows the box, so
     the two are one label at two scales rather than two labels. Same shape the
     workout screen's FINISH wears in this slot. -->
{#snippet go()}
	<Button variant="chrome" caps onclick={() => void start()}>START</Button>
{/snippet}

{#snippet deskActions()}
	<div class="hidden items-center gap-2 lg:flex">
		{#if persisted}
			{@render trash(20)}
		{/if}

		{@render go()}
	</div>
{/snippet}

<svelte:head>
	<title>{template.name.trim() === '' ? 'New template' : template.name} | Kilorep</title>
</svelte:head>

<svelte:window onkeydown={(e) => e.key === 'Escape' && drag.cancel()} />

<div class="flex min-h-0 flex-1 flex-col">
	<div class="relative flex min-h-0 flex-1">
		<!-- The plan, floating in the margin the window has left over. The geometry
		     is the workout rail's, to the pixel, and the reasoning lives there in
		     full: `left` is half the window, back the column's half-cap, back 16px
		     of air, back the card; 32rem at `lg` and 37rem at `xl` are those three
		     added up. Restated here rather than shared because a utility class
		     spanning two screens is a number nobody can change for one of them.

		     Taken out of the flow so the pane below is the full width of the window
		     and scrolls at its edge exactly as every other screen does — a rail
		     with a width would move the cards off the column every other screen
		     lands on. `inset-y-0` is the pane's height and nothing more, so
		     `max-h-full` on the card is exact: a plan longer than the window
		     scrolls inside the card rather than off the bottom of it. -->
		<aside
			class="absolute inset-y-0 left-[calc(50%-32rem)] hidden w-52 py-3
				lg:block xl:left-[calc(50%-37rem)] xl:w-72"
		>
			{#if entries.length > 0}
				<div class="max-h-full overflow-y-auto rounded-xl border border-line-soft bg-surface p-2">
					<PlanList
						{entries}
						onjump={jumpTo}
						oninsert={() => (insertOpen = true)}
						onreorder={(entryId, index) => moveEntry(template, entryId, index)}
					/>
				</div>
			{/if}
		</aside>

		<main bind:this={pane} class="min-h-0 flex-1 overflow-y-auto">
			<!-- The drag's root, and not the `<main>` above it: `DragOrder` reads the
			     flex gap off the first seam between cards, so its root has to be the
			     box that actually lays them out. It was never bound at all until now,
			     which is the whole of why a card in this pane could not be dragged —
			     `#rowFor` looked for rows through a null root, found none, and every
			     lift returned on its first guard. The sidebar's list has bound its own
			     since the day it was written, which is why that one worked. -->
			<div bind:this={drag.root} class="column-content flex min-h-full flex-col gap-3 px-3 pt-3">
				<!-- The name, at every width now that no screen draws its own header.
				     A title that happens to be typable: no border, no fill, no caps
				     label above it — the same 2xl extrabold the other detail screens
				     set their heading in, so it reads as the page's name and not as a
				     form with one field in it. It scrolls away with the cards, which a
				     name read once on arrival should, and the bar overhead keeps a
				     copy for when it has. -->
				<input
					bind:value={template.name}
					aria-label="Template name"
					placeholder="Push day"
					autocomplete="off"
					class="w-full rounded-lg bg-transparent px-1 text-2xl font-extrabold
						tracking-tight text-ink focus-ring placeholder:text-ink-faint"
				/>

				{#each entries as entry (entry.id)}
					{@const lifted = drag.isLifted(entry.id)}
					{@const settling = drag.settlingId === entry.id}

					<!-- Outer element for flip and slot measurement, inner for the finger —
					     the same split as PlanList, for the same reason. And as there, the
					     outer's box is the vacated slot while the card is airborne, so the
					     sunken fill is the landing shown at the card's exact size. -->
					<div
						data-drag-id={entry.id}
						animate:flip={{ duration: slide }}
						class={lifted ? 'relative z-10 rounded-2xl bg-sunken' : ''}
					>
						<!-- Handed to the first leg only, and to no other: the entry is what
						     moves, so one handle per entry is the honest count — a second would
						     be two ways to start the same drag, sitting a card apart.

						     Declared in here rather than at the top of the file because it
						     closes over the entry it drags, and inside the animated element
						     rather than beside it because that element has to be the each
						     block's only child. Same non-focusable grip as PlanList, same
						     reason. -->
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
							<!-- The workout pane's bracket, on the plan that starts it, so a
							     superset reads the same wherever it is looked at. -->
							<EntryStack legs={entry.legs} superset={entry.superset}>
								{#snippet leg(leg, at)}
									<PlanCard
										meta={leg.meta}
										exercise={leg.exercise}
										onoptions={(anchor) => options(leg.id, anchor)}
										onaddset={() => addSet(template, leg.id, crypto.randomUUID())}
										onremoveset={() => shrink(leg.id)}
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
					<!-- Outlined, not commit: the screen's one filled button is the sticky
					     Start below. No add row under this — the ask is already centred in
					     the pane, and a second way to do the only thing on screen is not a
					     second choice. -->
					<EmptyState title="Nothing planned" description="Add an exercise to shape the session.">
						{#snippet icon()}
							<Stack size={24} />
						{/snippet}
						{#snippet action()}
							<Button onclick={() => (insertOpen = true)}>Add exercise</Button>
						{/snippet}
					</EmptyState>
				{:else}
					<!-- Add-exercise gets its row back. It used to ride each add-set row as
					     a narrow second segment, which was the right home while every card
					     ended in one — the sets stepper does that job now, so the segment
					     had nothing left to ride on.

					     `raised` and not the dashed `AddRow`: this stands on the canvas
					     between cards, where a dashed hairline is the thing nobody finds.
					     Same variant the Templates tab grows its list with, which is the
					     point — the two planning surfaces add one the same way. -->
					<Button variant="raised" class="w-full" onclick={() => (insertOpen = true)}>
						+ Add exercise
					</Button>
				{/if}

				<!-- The phone's delete. On a desk it is in the bar overhead; here there
				     is no bar, and the foot of the plan is the one place a destructive
				     act can sit without being under a thumb that is aiming at Start.
				     Icon alone: the dialog behind it does the spelling out. -->
				{#if persisted}
					<div class="flex justify-center pt-2 pb-1 lg:hidden">
						{@render trash(18)}
					</div>
				{/if}

				<!-- Pinned inside the scroll pane, so Start is under the thumb however
				     long the plan grows. The tab bar below carries the gesture-bar
				     clearance on a phone; from `lg` the pane's own floor is the window's. -->
				<div
					bind:this={startBar}
					class="sticky bottom-0 -mx-3 mt-auto border-t border-line-soft bg-canvas px-3 py-3
						lg:pb-[max(0.75rem,var(--spacing-safe-b))]"
				>
					<Button variant="commit" class="w-full" onclick={() => void start()}>
						Start workout
					</Button>
				</div>
			</div>
		</main>
	</div>
</div>

<ExercisePickerSheet
	bind:open={insertOpen}
	title="Add exercise"
	multiple
	frequent={data.frequent}
	lastPerformed={data.lastPerformed}
	onpick={plan}
/>

<!-- The same picker, asking a different question — the workout screen's second
     opening of it, verbatim. `replacing` is what makes it a different question
     rather than the same list under another title: the sheet shelves substitutes
     for this exercise above the muscle sections, which is most of why a swap is
     faster than a remove and an add.

     What it answers to is a plan that survives the swap whole: the sets and the
     targets stay exactly as they were, so a 3 × 8 bench becomes a 3 × 8 incline
     press. Nothing is destroyed, so nothing is confirmed. -->
<ExercisePickerSheet
	bind:open={swapOpen}
	title="Swap exercise"
	replacing={actingGroup === null ? null : actingGroup.meta}
	lastPerformed={data.lastPerformed}
	onpick={([id]) => swapPick(id)}
/>

<!-- The third question, and the workout screen's verbatim again: what to
     superset this exercise with. What is already planned rides above the
     catalog, because pairing two things already on the list is what the gesture
     nearly always means. `multiple`, so a giant set is planned in one pass. -->
<ExercisePickerSheet
	bind:open={supersetOpen}
	title="Superset {actingGroup === null ? 'exercise' : actingGroup.meta.name} with…"
	multiple
	verb="Superset"
	pinned={supersetShelf}
	lastPerformed={data.lastPerformed}
	onpick={supersetPicks}
/>

<PlanOptionsMenu
	bind:open={optionsOpen}
	group={actingGroup}
	superset={actingEntry !== null && actingEntry.superset}
	anchor={optionsAnchor}
	onswap={() => (swapOpen = true)}
	onsuperset={() => (supersetOpen = true)}
	onbreak={breakSuperset}
	onremove={removePlanned}
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
