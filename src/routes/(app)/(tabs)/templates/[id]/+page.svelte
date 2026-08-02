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
		setExerciseReps,
		setPlannedReps,
		startFrom
	} from '$lib/domain/template';
	import { firstUncompleted } from '$lib/domain/workout';
	import BackLink from '$lib/nav/BackLink.svelte';
	import { appBarSlot } from '$lib/nav/bar.svelte';
	import { syncSoon } from '$lib/sync/client';
	import { plannedGroups } from '$lib/templates/plan';
	import PlanCard from '$lib/templates/PlanCard.svelte';
	import PlanList from '$lib/templates/PlanList.svelte';
	import { activeWorkout, SESSION_DEP } from '$lib/workout/active.svelte';
	import ExercisePickerSheet from '$lib/workout/ExercisePickerSheet.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import { DragOrder, SETTLE } from '$lib/ui/dragOrder.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import { revealNearest } from '$lib/ui/scroll';
	import DotsSixVertical from '$lib/ui/icons/DotsSixVertical.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

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

	const groups = $derived(plannedGroups(template, catalogById));

	// Deduplicated for the same superset reason as PlanList's, even though this
	// build's UI only ever makes one-exercise entries.
	const entryIds = $derived([...new Set(groups.map((group) => group.entryId))]);

	// Handle-only lift, unlike PlanList's hold-anywhere: these cards are full of
	// controls, and a long-press that lifted the card out from under a rep target
	// being held would fight the very gesture it shares a row with.
	//
	// The cards vary in height — a card with its per-set targets open is twice
	// the one beside it — which is fine: DragOrder measures each row's own height
	// at lift and computes the slots from them, so the thresholds land where the
	// cards actually are.
	const drag = new DragOrder({
		order: () => entryIds,
		move: (id, index) => {
			moveEntry(template, id, index);

			return true;
		}
	});

	const slide = $derived(prefersReducedMotion.current ? 0 : 200);

	let insertOpen = $state(false);

	function plan(exerciseId: string) {
		addExercise(template, exerciseId, {
			entry: crypto.randomUUID(),
			exercise: crypto.randomUUID(),
			sets: Array.from({ length: PLANNED_SET_COUNT }, () => crypto.randomUUID())
		});
	}

	/** Drop the last set of an exercise — the sets stepper's `−`. */
	function shrink(exerciseId: string) {
		const group = groups.find((candidate) => candidate.id === exerciseId);
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
	 * Removing a planned exercise asks first.
	 *
	 * The workout's own removal does not, unless sets have been logged — nothing
	 * is lost there but an empty row. Here the card *is* the work: the sets, the
	 * targets and the order someone sat down to decide, and there is no undo
	 * anywhere in the app. Held as an id and resolved live rather than
	 * snapshotted, for the reason the workout's option sheets give: a dialog
	 * naming a row that has since moved is worse than one naming nothing.
	 */
	let removeOpen = $state(false);
	let removing = $state<string | null>(null);

	const removingGroup = $derived(groups.find((group) => group.id === removing) ?? null);

	function askRemove(exerciseId: string) {
		removing = exerciseId;
		removeOpen = true;
	}

	function confirmRemove() {
		if (removing !== null) {
			removeExercise(template, removing);
			removing = null;
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
	 * The bar's right-hand slot from `lg`, given back on the way out.
	 *
	 * Start and delete both live up here on a desk, where there is a bar to hold
	 * them: the pane keeps its own Start under the thumb, and delete has left the
	 * foot of the plan entirely rather than sitting under the last exercise
	 * competing with it. On a phone there is no bar, so the header carries Start
	 * and the plan's foot keeps the trash — the same control, anchored where each
	 * device has room for it, which is the split the nav bars already make.
	 *
	 * The body reads nothing reactive, so this runs once and the snippet
	 * re-renders itself; `persisted` inside it is read where it is rendered.
	 */
	const bar = appBarSlot();

	$effect(() => {
		bar.action = deskActions;

		return () => {
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
			text-danger focus-ring hover:bg-surface-2 active:bg-surface-2"
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
	<div class="flex items-center gap-2">
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
	<!-- Back, the name and Start on one line, on a phone and nowhere else. The
	     name is the page's title and its one field at once, so it is a bare input
	     with no caps label over it: a label here would push the field onto a
	     second row and say "Name" above a box that already reads "Push day".

	     Bordered and opaque because the pane below scrolls under it.

	     Gone from `lg` up — the same `lg:hidden` the workout screen's header
	     wears, and now for the same reason. This bar used to stand at every
	     width, on the argument that the app bar has nowhere to put a text field:
	     true, and beside the point, because the pane does. Two bars stacked is
	     what that argument bought, and the field has moved into the pane below
	     rather than the chrome shrinking to accommodate it. START and the trash
	     are already up in the bar from `lg` — see `deskActions`. -->
	<header class="shrink-0 border-b border-line-soft bg-surface pt-safe-t lg:hidden">
		<div class="column-content flex items-center gap-2 px-3 py-2">
			<BackLink href="/templates" label="Back to templates" />

			<input
				bind:value={template.name}
				aria-label="Template name"
				placeholder="Push day"
				autocomplete="off"
				class="field-box min-h-chrome min-w-0 flex-1 border-line focus-ring"
			/>

			{@render go()}
		</div>
	</header>

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
			{#if groups.length > 0}
				<div class="max-h-full overflow-y-auto rounded-xl border border-line-soft bg-surface p-2">
					<PlanList
						{groups}
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
				<!-- The name, from `lg` up, where the header that used to carry it is
				     gone. A title that happens to be typable: no border, no fill, no
				     caps label above it — the same 2xl extrabold the Exercises and
				     History detail screens set their `h1` in, so it reads as the page's
				     name and not as a form with one field in it. It scrolls away with
				     the cards, which a name read once on arrival should. -->
				<input
					bind:value={template.name}
					aria-label="Template name"
					placeholder="Push day"
					autocomplete="off"
					class="hidden w-full rounded-lg bg-transparent px-1 text-2xl font-extrabold
						tracking-tight text-ink focus-ring placeholder:text-ink-faint lg:block"
				/>

				{#each groups as group (group.id)}
					{@const lifted = drag.isLifted(group.entryId)}
					{@const settling = drag.settlingId === group.entryId}

					<!-- Outer element for flip and slot measurement, inner for the finger —
					     the same split as PlanList, for the same reason. And as there, the
					     outer's box is the vacated slot while the card is airborne, so the
					     sunken fill is the landing shown at the card's exact size. -->
					<div
						data-drag-id={group.entryId}
						animate:flip={{ duration: slide }}
						class={lifted ? 'relative z-10 rounded-2xl bg-sunken' : ''}
					>
						<div
							style:transform={lifted ? `translateY(${drag.offset}px) scale(1.01)` : null}
							style:transition={settling && !prefersReducedMotion.current ? SETTLE : null}
							class={lifted ? 'shadow-lg' : ''}
						>
							<PlanCard
								meta={group.meta}
								exercise={group.exercise}
								onremove={() => askRemove(group.id)}
								onaddset={() => addSet(template, group.id, crypto.randomUUID())}
								onremoveset={() => shrink(group.id)}
								onreps={(reps) => setExerciseReps(template, group.id, reps)}
								onsetreps={(setId, reps) => setPlannedReps(template, setId, reps)}
							>
								{#snippet grip()}
									<!-- Same non-focusable grip as PlanList, same reason. -->
									<span
										role="presentation"
										aria-hidden="true"
										onpointerdown={(event) => drag.handleDown(event, group.entryId)}
										onpointermove={(event) => drag.move(event)}
										onpointerup={(event) => drag.up(event)}
										onpointercancel={(event) => drag.up(event)}
										class="grid size-11 shrink-0 cursor-grab touch-none place-items-center
											text-ink-faint select-none"
									>
										<DotsSixVertical size={18} />
									</span>
								{/snippet}
							</PlanCard>
						</div>
					</div>
				{/each}

				{#if groups.length === 0}
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
	lastPerformed={data.lastPerformed}
	onpick={plan}
/>

<AlertDialog
	bind:open={removeOpen}
	title="Remove {removingGroup === null ? 'this exercise' : removingGroup.meta.name}?"
	description="Its sets and rep targets go with it. Workouts already logged from this plan keep theirs."
	confirmLabel="Remove"
	onconfirm={confirmRemove}
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
