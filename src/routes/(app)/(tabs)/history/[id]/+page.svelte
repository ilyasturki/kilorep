<script lang="ts">
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';
	import { goto, invalidate } from '$app/navigation';

	import { catalogById } from '$lib/catalog';
	import { driftFrom, hasDrift, hasSetDrift } from '$lib/domain/drift';
	import type { SetDrift } from '$lib/domain/drift';
	import {
		addExercise,
		addSet,
		cursorFor,
		draftSet,
		firstUncompleted,
		markSet,
		moveEntry,
		removeEntry,
		removeSet,
		repeatFrom,
		replaceEntry
	} from '$lib/domain/workout';
	import { workoutTitle } from '$lib/history/label';
	import WorkoutOptionsSheet from '$lib/history/WorkoutOptionsSheet.svelte';
	import WorkoutSection from '$lib/history/WorkoutSection.svelte';
	import BackLink from '$lib/nav/BackLink.svelte';
	import { pageSlide } from '$lib/nav/transitions';
	import { syncSoon } from '$lib/sync/client';
	import { groupsWithMeta } from '$lib/workout/groups';
	import { activeWorkout, SESSION_DEP } from '$lib/workout/active.svelte';
	import ExerciseOptionsSheet from '$lib/workout/ExerciseOptionsSheet.svelte';
	import ExercisePickerSheet from '$lib/workout/ExercisePickerSheet.svelte';
	import AddRow from '$lib/ui/AddRow.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import { DragOrder, SETTLE } from '$lib/ui/dragOrder.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import { registerOverlay } from '$lib/ui/overlays';
	import SetOptionsSheet from '$lib/workout/SetOptionsSheet.svelte';
	import ClockCounterClockwise from '$lib/ui/icons/ClockCounterClockwise.svelte';
	import DotsSixVertical from '$lib/ui/icons/DotsSixVertical.svelte';
	import More from '$lib/ui/icons/More.svelte';

	import type { PageProps } from './$types';

	/**
	 * One past workout, read as it was lifted: every set in session order,
	 * warmups and unchecked slots included, because the record is the session and
	 * a view that tidied it would be editing by omission.
	 *
	 * And begun again, from the sticky commit: PRODUCT.md's "Repeat this
	 * workout", the record as a plan for today — structure only, see
	 * `repeatFrom`.
	 *
	 * And corrected, behind the `⋯` menu's Edit. A logged number can be wrong —
	 * the wrong bar typed, a set checked that was never lifted, an exercise left
	 * in that was abandoned — and the app's only answer used to be deleting the
	 * whole session. What edit mode reaches is what the gym floor reaches: the
	 * values, the claim, the sets, the exercises and their order. What it never
	 * touches is when the session happened or which plan it counts against; a set
	 * fixed on Sunday must not move a Thursday workout's clock.
	 *
	 * Everything downstream is derived on read — hints, records, the exercise
	 * detail's history, the drift badges above — so a correction lands everywhere
	 * at once with nothing to invalidate.
	 *
	 * Drift is against the template as it stands today (see `domain/drift`), and
	 * only when that template still exists: badges on the groups that deviated, a
	 * dashed section for what was planned and never done, and nothing at all when
	 * there was never a plan to hold the session against.
	 */
	let { data }: PageProps = $props();

	/**
	 * The page owns the live tree; the load's copy is where it starts. Read once
	 * by design, the same bargain the template editor strikes: every path into a
	 * past workout re-enters through the History tab, so the prop never changes
	 * under a live page.
	 */
	// svelte-ignore state_referenced_locally
	const workout = $state(data.workout);

	const template = $derived(data.template);

	const title = $derived(workoutTitle(workout, template === null ? [] : [template]));
	const drift = $derived(template === null ? null : driftFrom(workout, template));

	const groups = $derived(groupsWithMeta(workout, catalogById));

	/**
	 * Persistence as a side effect of existing, exactly as on the template
	 * editor: `$state.snapshot` reads every leaf synchronously, so this effect
	 * tracks all of them and re-runs on any mutation — a nudged weight, a
	 * toggled disc, a reorder. The write is fire-and-forget; nothing on screen
	 * waits for IndexedDB.
	 *
	 * The first run is mount, not an edit, and is skipped: every save is dirty
	 * and syncs, so opening a workout to read it must not stamp a no-op push.
	 */
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

	/**
	 * How many sets an exercise added while editing arrives with, and it is
	 * deliberately not `insertedSetCount`'s answer.
	 *
	 * That rule reads the hint map as it stands *today* — the last time each
	 * exercise was performed, which for a session from March is very likely
	 * after this one ended. Shaping an old record by later lifting would be the
	 * app inventing a session. Three is the same rule's answer where nothing
	 * recalls anything, and the sets arrive blank for the reason: nobody lifted
	 * them, so nothing may propose what they held.
	 */
	const ADDED_SETS = 3;

	const ids = () => Array.from({ length: ADDED_SETS }, () => crypto.randomUUID());

	let editing = $state(false);

	/** The set expanded into an editor, or null. Only ever set while editing. */
	let openSetId = $state<string | null>(null);

	// Edit mode is a place — entered with the same rightward slide a deeper
	// route gets, left with the same pop, address unchanged. `pageSlide` falls
	// back to a bare flip where transitions are unsupported or unwanted.
	function startEditing() {
		pageSlide('push', () => (editing = true));
	}

	function stopEditing() {
		pageSlide('pop', () => {
			editing = false;
			openSetId = null;
		});
	}

	/**
	 * Edit mode is the innermost thing on this screen while it is on, so a
	 * hardware back leaves it before it leaves the page — the same rule every
	 * sheet and dialog registers for, and the stack keeps them in order: a sheet
	 * opened while editing still closes first.
	 */
	$effect(() => {
		if (!editing) {
			return;
		}

		return registerOverlay(stopEditing);
	});

	function draft(setId: string, weight: number | null, reps: number | null) {
		draftSet(workout, setId, { weight, reps });
	}

	/**
	 * The disc: claim this set, or take the claim back.
	 *
	 * A set holding no numbers cannot claim it happened — `markSet` refuses, and
	 * a disc that silently did nothing would read as broken — so the tap opens
	 * the editor instead, which is where the thing it is missing gets answered.
	 */
	function toggle(setId: string) {
		const cursor = cursorFor(workout, setId);

		if (cursor === null) {
			return;
		}

		if (!markSet(workout, setId, !cursor.set.completed)) {
			openSetId = setId;
		}
	}

	/**
	 * A set arrives blank, so the editor opens on it: there is nothing to read on
	 * the row it just added, and the numbers are the whole point of adding one.
	 */
	function add(exerciseId: string) {
		const set = addSet(workout, exerciseId, crypto.randomUUID());

		if (set !== null) {
			openSetId = set.id;
		}
	}

	// A list, the picker's shape everywhere. The editor opens on the first of
	// them for the reason it opens at all: the sets arrived blank, and the first
	// is where filling them in starts.
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

	/**
	 * The exercise-level sheet, and the picker a swap opens behind it. Addressed
	 * by entry id and resolved out of the live tree on every read, the same care
	 * the workout screen takes: a swap rebuilds the entry underneath, and a group
	 * snapshotted on open would have the sheet naming an exercise that has left.
	 */
	let exerciseOpen = $state(false);
	let swapOpen = $state(false);
	let swapping = $state<string | null>(null);

	const exerciseGroup = $derived(groups.find((group) => group.entryId === swapping) ?? null);

	function exerciseOptions(entryId: string) {
		swapping = entryId;
		exerciseOpen = true;
	}

	function swap(exerciseId: string) {
		if (swapping === null) {
			return;
		}

		const entry = replaceEntry(workout, swapping, exerciseId, {
			exercise: crypto.randomUUID(),
			sets: ids()
		});

		swapping = null;

		// The sets that were there answered to a different exercise, so the
		// replacements are blank — and the first of them is what the user has to
		// fill in before the swap means anything.
		openSetId = entry === null ? null : entry.exercises[0].sets[0].id;
	}

	function dropExercise() {
		if (swapping === null) {
			return;
		}

		removeEntry(workout, swapping);
		swapping = null;
		openSetId = null;
	}

	/**
	 * The set-options sheet, one instance for the screen and addressed by id —
	 * resolved live for the reason the exercise one is: removing a set renumbers
	 * the ones below it, and a cursor captured on open would describe a row that
	 * has moved.
	 */
	let optionsOpen = $state(false);
	let optionsSetId = $state<string | null>(null);

	const optionsGroup = $derived(
		groups.find((group) => group.cursors.some((c) => c.set.id === optionsSetId)) ?? null
	);

	const optionsCursor = $derived(
		optionsGroup === null
			? null
			: (optionsGroup.cursors.find((c) => c.set.id === optionsSetId) ?? null)
	);

	function setOptions(setId: string) {
		optionsSetId = setId;
		optionsOpen = true;
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

	// Deduplicated for the superset reason every other draggable list gives:
	// one entry can render as two groups, and they travel as one.
	const entryIds = $derived([...new Set(groups.map((group) => group.entryId))]);

	// Handle-only lift, like the template editor's cards and unlike SessionList's
	// hold-anywhere: these sections are full of controls, and a long-press that
	// lifted the card out from under a disc being pressed would fight the gesture
	// it shares a row with.
	const drag = new DragOrder({
		order: () => entryIds,
		move: (id, index) => moveEntry(workout, id, index)
	});

	const slide = $derived(prefersReducedMotion.current ? 0 : 200);

	// Year included, unlike the list's day-and-month: the list is scanned, the
	// detail is consulted, and "12 Jan" stops answering which January soon.
	const when = new Intl.DateTimeFormat('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});

	function driftMarks(setDrift: SetDrift): string[] {
		const marks: string[] = [];

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

	/** Drift as words, per exercise. Empty where there is no plan to deviate from. */
	function badgesFor(exerciseNodeId: string): string[] {
		if (drift === null) {
			return [];
		}

		const setDrift = drift.matched[exerciseNodeId];

		if (setDrift === undefined) {
			return ['Unplanned'];
		}

		return hasSetDrift(setDrift) ? driftMarks(setDrift) : [];
	}

	/**
	 * The record's own `⋯`: what this workout can be besides read. Edit is a
	 * mode, delete is a confirm, and neither happens from inside the sheet — see
	 * `WorkoutOptionsSheet`.
	 */
	let menuOpen = $state(false);

	let deleteOpen = $state(false);

	async function deleteWorkout() {
		await data.store.deleteWorkout(workout.id, Date.now());

		if (data.user) {
			syncSoon(data.user.id);
		}

		await goto('/history');
	}

	/**
	 * Repeat-as-resume, the template editor's handoff verbatim: `repeatFrom`
	 * mints the session, the snapshot is written, and the workout screen begins
	 * from it on arrival — no second start-path to keep honest.
	 */
	async function launch() {
		activeWorkout.finish();

		const next = repeatFrom(workout, Date.now(), () => crypto.randomUUID());
		const first = firstUncompleted(next);

		await data.store.saveSnapshot({
			workout: next,
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
	 * The same gate the editor's Start stands behind, for the same reason:
	 * exactly one workout is active at a time, and a live session — or a
	 * snapshot waiting out a reload — may hold logged sets that overwriting
	 * would destroy. This is a reading surface, not the gym floor; the dialog
	 * costs nothing the loop rule protects.
	 */
	async function repeat() {
		if (activeWorkout.session !== null || (await data.store.loadSnapshot()) !== null) {
			discardOpen = true;

			return;
		}

		await launch();
	}
</script>

<svelte:head>
	<title>{title} | Kilorep</title>
</svelte:head>

<svelte:window onkeydown={(e) => e.key === 'Escape' && drag.cancel()} />

<!-- One handle for every section rather than one declared per iteration: a
     snippet inside the `{#each}` would leave the animated wrapper with a
     sibling, and `animate:` requires the sole child of a keyed block. Same
     non-focusable grip as SessionList's, same reason — reorder is a pointer
     gesture with no keyboard path, and a control Tab lands on that then ignores
     every key is worse than one Tab skips. -->
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

<!-- No bottom padding of its own: the sticky Repeat bar carries the foot of
     the page, the same bargain the template editor strikes — and pays it back
     for the stretch where editing takes that bar away. -->
<main
	class={[
		'column-content flex min-h-full flex-col gap-5 px-3 pt-safe-t lg:pt-0',
		editing && 'pb-4'
	]}
>
	<!-- Back, name and actions on one line. The title pays for it — `text-xl` and
	     truncated, where it used to have a row of its own at `text-2xl` — and that
	     is the trade: what a bar of chrome above a heading was spending was a
	     screenful of vertical space on a screen that is read by scrolling. -->
	<header class="flex flex-col gap-1 pt-3">
		<div class="flex items-center gap-2">
			<!-- It stays navigation in both postures: Done is beside it, and a back
			     arrow that sometimes went back and sometimes did not would be the
			     surprise DESIGN.md rules out. This screen is the one the exercise
			     page links into, which is why `/history` alone was not enough — see
			     `BackLink`. -->
			<BackLink href="/history" label="Back to history" />

			<h1 class="min-w-0 flex-1 truncate text-xl font-extrabold tracking-tight">{title}</h1>

			<!-- Editing swaps both actions for the one way out. Repeating a session
			     mid-correction is not a gesture anyone means, and DONE landing in the
			     slot the thumb just left is what makes edit mode feel like a mode
			     rather than a place. -->
			{#if editing}
				<Button variant="chrome" caps onclick={stopEditing}>DONE</Button>
			{:else}
				<!-- Outlined, not the accent: the lit Repeat is the one pinned at the
				     foot, and Button's rule is one filled button per screen. This is the
				     same act within reach of the eye rather than the thumb. -->
				<Button variant="chrome" caps onclick={() => void repeat()}>REPEAT</Button>

				<button
					type="button"
					aria-label="Workout options"
					onclick={() => (menuOpen = true)}
					class="grid min-h-chrome w-11 shrink-0 place-items-center rounded-full
						text-ink-muted focus-ring hover:bg-surface-2 active:bg-surface-2"
				>
					<More size={20} />
				</button>
			{/if}
		</div>

		<!-- The date and nothing about the clock: a session is a day here, and how
		     many minutes it ran was a number the record happened to be able to
		     compute rather than one anybody came to read. -->
		<p class="px-1 text-md font-bold text-ink-faint">
			{when.format(workout.startedAt)}
			{#if drift !== null && !hasDrift(drift)}· as planned{/if}
		</p>
	</header>

	<div class="flex flex-1 flex-col gap-3">
		<!-- The drag wrapper stands in both postures: nothing can lift without the
		     grip, which only edit mode draws, and a second markup path for the
		     reading posture would be the same section written twice. -->
		<div bind:this={drag.root} class="flex flex-col gap-3">
			{#each groups as group (group.id)}
				{@const lifted = drag.isLifted(group.entryId)}
				{@const settling = drag.settlingId === group.entryId}

				<!-- Outer element for flip and slot measurement, inner for the finger —
				     the same split every draggable list here makes. While the inner is
				     off following the finger the outer's box is the vacated slot, so the
				     sunken fill is the landing shown at the section's exact size. -->
				<div
					data-drag-id={group.entryId}
					animate:flip={{ duration: slide }}
					class={lifted ? 'relative z-10 rounded-2xl bg-sunken' : ''}
				>
					<div
						style:transform={lifted ? `translateY(${drag.offset}px) scale(1.01)` : null}
						style:transition={settling && !prefersReducedMotion.current ? SETTLE : null}
						class={['rounded-2xl', lifted && 'shadow-lg']}
					>
						<WorkoutSection
							meta={group.meta}
							entryId={group.entryId}
							cursors={group.cursors}
							badges={badgesFor(group.id)}
							{editing}
							{openSetId}
							onopen={(setId) => (openSetId = setId)}
							onclose={() => (openSetId = null)}
							ondraft={draft}
							ontoggle={toggle}
							onoptions={setOptions}
							onexercise={() => exerciseOptions(group.entryId)}
							onadd={() => add(group.cursors[0].exercise.id)}
							grip={editing ? handle : undefined}
						/>
					</div>
				</div>
			{/each}
		</div>

		{#if editing}
			<!-- The same dashed silhouette the sections grow by, one level up. -->
			<AddRow label="Add exercise" onclick={() => (insertOpen = true)} />
		{:else if groups.length === 0}
			<!-- Editing down to nothing is allowed — the record is still a record of a
			     day, and Delete is right there for a session that should not have
			     been. It must not read as a blank page, though. -->
			<div class="flex flex-1 flex-col justify-center">
				<EmptyState title="Nothing in this workout" description="Every exercise has been removed.">
					{#snippet icon()}
						<ClockCounterClockwise size={24} />
					{/snippet}
				</EmptyState>
			</div>
		{/if}

		{#if drift !== null && drift.missing.length > 0}
			<!-- The dashed silhouette the app draws for absence: planned slots the
			     session never filled. Keyed by index — the same exercise can be
			     planned, and skipped, twice. -->
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

	<!-- Pinned like the editor's Start, because it is the same act from a
	     different door: this record, begun again. Structure only — see
	     `repeatFrom` — so today's numbers arrive from the hints, not from a
	     prefill nobody entered today.

	     Gone while editing, with the top bar's REPEAT — `main` grows the foot
	     padding back for the stretch, so the last section never sits flush on the
	     tab bar. -->
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

<!-- The same picker asking a different question, opening as the options sheet
     closes — the handover the workout screen already makes. -->
<ExercisePickerSheet
	bind:open={swapOpen}
	title="Swap exercise"
	replacing={exerciseGroup === null ? null : exerciseGroup.meta}
	lastPerformed={data.lastPerformed}
	onpick={([id]) => swap(id)}
/>

<ExerciseOptionsSheet
	bind:open={exerciseOpen}
	group={exerciseGroup}
	onswap={() => (swapOpen = true)}
	onremove={dropExercise}
/>

<WorkoutOptionsSheet
	bind:open={menuOpen}
	{title}
	onedit={startEditing}
	ondelete={() => (deleteOpen = true)}
/>

<SetOptionsSheet
	bind:open={optionsOpen}
	cursor={optionsCursor}
	removable={optionsGroup !== null && optionsGroup.cursors.length > 1}
	onremove={dropSet}
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
