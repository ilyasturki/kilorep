<script lang="ts">
	import { tick } from 'svelte';
	import { flip } from 'svelte/animate';
	import { MediaQuery } from 'svelte/reactivity';
	import { goto, invalidate } from '$app/navigation';

	import { catalogById } from '$lib/catalog';
	import { restAfter } from '$lib/domain/rest';
	import { fillAppBar } from '$lib/nav/bar.svelte';
	import { restSettings } from '$lib/settings/rest.svelte';
	import { syncSoon } from '$lib/sync/client';
	import { restTimer } from '$lib/workout/rest.svelte';
	import { entriesWithMeta, entryOf, legOf, shelfOf } from '$lib/workout/groups';
	import { activeWorkout, SESSION_DEP } from '$lib/workout/active.svelte';
	import EntryStack from '$lib/workout/EntryStack.svelte';
	import ExerciseBlock from '$lib/workout/ExerciseBlock.svelte';
	import ExerciseOptionsMenu from '$lib/workout/ExerciseOptionsMenu.svelte';
	import ExercisePickerSheet from '$lib/workout/ExercisePickerSheet.svelte';
	import OverviewDrawer from '$lib/workout/OverviewDrawer.svelte';
	import { persistSession } from '$lib/workout/persist.svelte';
	import OverviewPeek from '$lib/workout/OverviewPeek.svelte';
	import SessionList from '$lib/workout/SessionList.svelte';
	import SetOptionsMenu from '$lib/workout/SetOptionsMenu.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import { playMorphs } from '$lib/ui/morph';
	import { quickMs } from '$lib/ui/motion';
	import { coarsePointer } from '$lib/ui/pointer';
	import { fullyVisible, instantly, revealNearest, revealSpan, revealStart } from '$lib/ui/scroll';
	import Stack from '$lib/ui/icons/Stack.svelte';
	import { press, SLOP } from '$lib/ui/press';

	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const session = $derived(activeWorkout.session);

	let intent: 'jump' | 'advance' = 'advance';
	let scheduled = false;

	let arriving = true;

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

	async function settle() {
		if (scheduled) {
			return;
		}

		scheduled = true;
		await tick();
		scheduled = false;

		if (arriving) {
			arriving = false;
			instantly(reveal);
		} else {
			reveal();
		}

		playMorphs();
	}

	function jumped() {
		intent = 'jump';
		void settle();
	}

	function jumpTo(setId: string) {
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

	function commitSet(weight: number, reps: number) {
		if (session === null) {
			return;
		}

		const committed = session.commit(weight, reps);

		if (committed === null) {
			return;
		}

		const earned = restAfter(session.workout, committed, restSettings.current);

		if (earned === null) {
			restTimer.clear();
		} else {
			restTimer.start(earned);
		}
	}

	// The tail order is load-bearing — snapshot, holder, invalidation, navigation:
	// `/workout` bounces back here while any of them still says a workout runs.
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

	const entries = $derived(session === null ? [] : entriesWithMeta(session.workout, catalogById));

	const slide = $derived(quickMs());

	let overview = $state(false);
	let instant = $state(false);

	// 64rem is Tailwind's `lg`, where the rail is always open and there is no drawer to swipe.
	const railed = new MediaQuery('min-width: 64rem', false);

	let drag: { id: number; x0: number; y0: number; x: number; at: number; v: number } | null = null;

	let peek = $state<number | null>(null);
	let peekWidth = $state(0);
	let settling = $state(false);

	let swallow = false;

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

		if (dy > SLOP && dy > dx) {
			drag = null;
			return;
		}

		if (dx > SLOP && dx > 2 * dy) {
			event.currentTarget.setPointerCapture(drag.id);
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
		if (drag === null || peek === null) {
			drag = null;
			return;
		}

		const opened = peek >= peekWidth * SETTLE_AT || drag.v > FLING;
		const target = opened ? peekWidth : 0;

		drag = null;
		swallow = true;

		// A transition with nothing to do never fires `transitionend`, so settle here instead.
		if (target === peek || quickMs() === 0) {
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

	let finishing = $state(false);

	const owed = $derived(
		entries.flatMap((entry) => entry.cursors).filter((cursor) => !cursor.set.completed).length
	);

	const owedLabel = $derived(
		owed === 0
			? 'Every set is logged.'
			: `${owed} set${owed === 1 ? '' : 's'} still owed. The session ends as it stands.`
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

	fillAppBar(() => ({ action: liveActions }));
</script>

{#snippet liveActions()}
	<div class="flex items-center gap-2">
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

		{@render finish()}
	</div>
{/snippet}

{#snippet finish()}
	<Button variant="chrome" caps onclick={() => (finishing = true)}>FINISH</Button>
{/snippet}

<svelte:head>
	<title>Workout | Kilorep</title>
</svelte:head>

{#if session !== null}
	<div class="flex min-h-0 flex-1 flex-col">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="relative flex min-h-0 flex-1"
			onpointerdown={swipeStart}
			onpointermove={swipeMove}
			onpointerup={swipeEnd}
			onpointercancel={swipeEnd}
			onclickcapture={swipeClick}
		>
			<!-- 19rem is the column's 288px half-cap plus 16px of air; the 13rem floor makes
			     576 + 2 × (208 + 16) = 1024, so the rail lands flush the moment `lg` hits. -->
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

			<!-- `touch-pan-y` has to sit on the scroller: `touch-action` intersects from the touched
			     element up to it only, so on the wrapper above it is never read and the swipe dies. -->
			<main
				class="min-h-0 flex-1 touch-pan-y overflow-y-auto py-3 pb-[max(1.5rem,var(--spacing-safe-b))]"
			>
				<div
					class={['column-content flex flex-col gap-7 px-3', entries.length === 0 && 'min-h-full']}
				>
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
										cursors={leg.cursors}
										history={data.history}
										activeSetId={session.activeSetId}
										oncommit={commitSet}
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
