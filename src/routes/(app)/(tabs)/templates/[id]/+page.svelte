<script lang="ts">
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';
	import { goto } from '$app/navigation';

	import { catalogById } from '$lib/catalog';
	import {
		addExercise,
		addSet,
		isBlank,
		moveEntry,
		PLANNED_SET_COUNT,
		removeExercise,
		removeSet,
		setPlannedReps,
		startFrom
	} from '$lib/domain/template';
	import type { TemplateExercise, TemplateSet } from '$lib/domain/template';
	import type { Exercise } from '$lib/domain/exercise';
	import { firstUncompleted } from '$lib/domain/workout';
	import { syncSoon } from '$lib/sync/client';
	import { activeWorkout } from '$lib/workout/active.svelte';
	import ExercisePickerSheet from '$lib/workout/ExercisePickerSheet.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import { DragOrder, SETTLE } from '$lib/ui/dragOrder.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Input from '$lib/ui/Input.svelte';
	import DotsSixVertical from '$lib/ui/icons/DotsSixVertical.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';

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

	type Planned = {
		/** The exercise node id — what a `{#each}` keys on and a removal names. */
		id: string;
		entryId: string;
		meta: Exercise;
		exercise: TemplateExercise;
	};

	const groups = $derived<Planned[]>(
		template.entries.flatMap((entry) =>
			entry.exercises.map((exercise) => ({
				id: exercise.id,
				entryId: entry.id,
				meta: catalogById[exercise.exerciseId],
				exercise
			}))
		)
	);

	// Deduplicated for the same superset reason as SessionList's, even though
	// this build's UI only ever makes one-exercise entries.
	const entryIds = $derived([...new Set(groups.map((group) => group.entryId))]);

	// Handle-only lift, unlike SessionList's hold-anywhere: these cards are
	// full of controls, and a long-press that lifts the card out from under a
	// rep target being held would fight the very gesture it shares a row with.
	//
	// The cards vary in height with set count, which is fine: DragOrder
	// measures each row's own height at lift and computes the slots from them,
	// so the thresholds land where the cards actually are.
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

	/**
	 * The first + on an open target proposes 8 — the gym's default rep shape,
	 * the same spirit as three default sets — rather than a 1 nobody ever
	 * planned. From there the arms step by one, and stepping down through 1
	 * clears back to open, so the whole range is reachable from either end.
	 */
	const DEFAULT_TARGET = 8;

	function raise(set: TemplateSet) {
		setPlannedReps(
			template,
			set.id,
			set.plannedReps === null ? DEFAULT_TARGET : set.plannedReps + 1
		);
	}

	function lower(set: TemplateSet) {
		if (set.plannedReps === null) {
			return;
		}

		setPlannedReps(template, set.id, set.plannedReps === 1 ? null : set.plannedReps - 1);
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

		await goto('/workout');
	}

	let discardOpen = $state(false);

	/**
	 * Exactly one workout is active at a time, and this button must not make a
	 * second one silently: a live session, or a snapshot waiting to be resumed
	 * after a reload, may hold logged sets that overwriting would destroy. The
	 * dialog is the only honest gate — this is a planning surface, not the
	 * gym floor, so the in-gym rule has nothing to say about it.
	 */
	async function start() {
		if (activeWorkout.session !== null || (await data.store.loadSnapshot()) !== null) {
			discardOpen = true;

			return;
		}

		await launch();
	}
</script>

<svelte:head>
	<title>{template.name.trim() === '' ? 'New template' : template.name} | Kilorep</title>
</svelte:head>

<svelte:window onkeydown={(e) => e.key === 'Escape' && drag.cancel()} />

<main class="column-content flex min-h-full flex-col gap-5 px-3 pt-safe-t lg:pt-0">
	<header class="flex flex-col gap-3 pt-3">
		<!-- `‹` is a character, like ListRow's `›` — the subset carries it. -->
		<a
			href="/templates"
			aria-label="Back to templates"
			class="grid min-h-chrome w-11 place-items-center self-start rounded-full border
				border-line text-xl leading-none text-ink-muted focus-ring hover:bg-surface-2
				active:bg-surface-2"
		>
			‹
		</a>

		<Input label="Name" placeholder="Push day" bind:value={template.name} />
	</header>

	<div bind:this={drag.root} class="flex flex-1 flex-col gap-3">
		{#each groups as group, index (group.id)}
			{@const lifted = drag.isLifted(group.entryId)}
			{@const settling = drag.settlingId === group.entryId}

			<!-- Outer element for flip and slot measurement, inner for the finger —
			     the same split as SessionList, for the same reason. And as there,
			     the outer's box is the vacated slot while the card is airborne, so
			     the sunken fill is the landing shown at the card's exact size. -->
			<div
				data-drag-id={group.entryId}
				animate:flip={{ duration: slide }}
				class={lifted ? 'relative z-10 rounded-2xl bg-sunken' : ''}
			>
				<section
					style:transform={lifted ? `translateY(${drag.offset}px) scale(1.01)` : null}
					style:transition={settling && !prefersReducedMotion.current ? SETTLE : null}
					class={[
						'flex flex-col gap-2 rounded-2xl border border-line-soft bg-surface p-3',
						lifted && 'shadow-lg'
					]}
				>
					<div class="flex items-center gap-1">
						<div class="min-w-0 flex-1 px-1">
							<h2 class="truncate text-lg font-extrabold tracking-tight text-ink">
								{group.meta.name}
							</h2>
							<p class="truncate text-sm font-bold text-ink-faint">
								{group.meta.equipment}{group.meta.loadMode === 'per-hand' ? ' · per hand' : ''}
							</p>
						</div>

						<!-- An edit, not a loss of data — the plan is not history — so no
						     dialog. `×` is a character the subset carries (the hint label
						     spells 80 × 8 with it). -->
						<button
							type="button"
							aria-label="Remove {group.meta.name}"
							onclick={() => removeExercise(template, group.id)}
							class="grid size-11 shrink-0 place-items-center rounded-full text-xl leading-none
								text-ink-faint focus-ring hover:bg-surface-2 active:bg-surface-2"
						>
							×
						</button>

						<!-- Same non-focusable grip as SessionList, same reason. -->
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
					</div>

					{#each group.exercise.sets as set, setIndex (set.id)}
						<div class="flex items-center gap-2">
							<span class="w-11 shrink-0 px-1 label-caps text-ink-faint">Set {setIndex + 1}</span>

							<div
								class="flex min-h-11 flex-1 items-stretch rounded-xl bg-sunken"
								role="group"
								aria-label="Set {setIndex + 1} rep target"
							>
								<button
									type="button"
									aria-label="Lower rep target"
									onclick={() => lower(set)}
									class="grid w-11 shrink-0 place-items-center rounded-l-xl text-xl font-semibold
										text-ink-muted focus-ring-inset select-none hover:bg-surface-2
										active:bg-surface-2 active:text-ink"
								>
									−
								</button>

								{#if set.plannedReps === null}
									<span
										class="flex min-w-0 flex-1 items-center justify-center text-md font-bold
											text-ink-faint"
									>
										Open
									</span>
								{:else}
									<span
										class="flex min-w-0 flex-1 items-center justify-center text-md font-extrabold
											tracking-numeral text-ink"
									>
										{set.plannedReps} reps
									</span>
								{/if}

								<button
									type="button"
									aria-label="Raise rep target"
									onclick={() => raise(set)}
									class="grid w-11 shrink-0 place-items-center rounded-r-xl text-xl font-semibold
										text-ink-muted focus-ring-inset select-none hover:bg-surface-2
										active:bg-surface-2 active:text-ink"
								>
									+
								</button>
							</div>

							<button
								type="button"
								aria-label="Remove set {setIndex + 1}"
								disabled={group.exercise.sets.length === 1}
								onclick={() => removeSet(template, set.id)}
								class="grid size-11 shrink-0 place-items-center rounded-full text-xl leading-none
									text-ink-faint focus-ring hover:bg-surface-2 active:bg-surface-2
									disabled:opacity-40"
							>
								×
							</button>
						</div>
					{/each}

					<!-- The dashed grow-by-one silhouette, per ExerciseBlock. -->
					<button
						type="button"
						onclick={() => addSet(template, group.id, crypto.randomUUID())}
						class="grid min-h-row place-items-center rounded-xl border border-dashed border-line
							text-ink-muted focus-ring hover:bg-surface-2 active:bg-surface-2"
					>
						<span class="label-caps">+ Add set</span>
					</button>
				</section>
			</div>
		{/each}

		{#if groups.length === 0}
			<EmptyState title="Nothing planned" description="Add an exercise to shape the session.">
				{#snippet icon()}
					<Stack size={24} />
				{/snippet}
			</EmptyState>
		{/if}

		<button
			type="button"
			onclick={() => (insertOpen = true)}
			class="grid min-h-row place-items-center rounded-xl border border-dashed border-line
				text-ink-muted focus-ring hover:bg-surface-2 active:bg-surface-2"
		>
			<span class="label-caps">+ Add exercise</span>
		</button>

		{#if persisted}
			<Button variant="destructive" class="self-center" onclick={() => (deleteOpen = true)}>
				Delete template
			</Button>
		{/if}
	</div>

	<!-- Pinned inside the scroll pane, so Start is under the thumb however long
	     the plan grows. The tab bar below carries the gesture-bar clearance. -->
	<div class="sticky bottom-0 -mx-3 mt-auto border-t border-line-soft bg-canvas px-3 py-3">
		<Button variant="commit" class="w-full" onclick={() => void start()}>Start workout</Button>
	</div>
</main>

<ExercisePickerSheet bind:open={insertOpen} title="Add exercise" onpick={plan} />

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
