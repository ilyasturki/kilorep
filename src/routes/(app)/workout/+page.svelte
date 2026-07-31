<script lang="ts">
	import { goto } from '$app/navigation';

	import { catalogById } from '$lib/catalog';
	import { appBarSlot } from '$lib/nav/bar.svelte';
	import { syncSoon } from '$lib/sync/client';
	import { groupsWithMeta } from '$lib/workout/groups';
	import { activeWorkout } from '$lib/workout/active.svelte';
	import ExerciseBlock from '$lib/workout/ExerciseBlock.svelte';
	import ExerciseOptionsSheet from '$lib/workout/ExerciseOptionsSheet.svelte';
	import ExercisePickerSheet from '$lib/workout/ExercisePickerSheet.svelte';
	import OverviewSheet from '$lib/workout/OverviewSheet.svelte';
	import SessionList from '$lib/workout/SessionList.svelte';
	import SetOptionsSheet from '$lib/workout/SetOptionsSheet.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
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
	 * pulls the active set back to centre after a commit, because in a stacked
	 * session it otherwise marches off the bottom of the page.
	 *
	 * From `xl` up the session list the sheet holds on a phone is a card floating
	 * in the left gutter, beside the pane being logged into rather than in front
	 * of it: the pane stays where every other screen's column is, and the card
	 * lives in the margin the window has left over. Below `xl` there is no room
	 * for it — the arithmetic is in the markup — so the overview button follows
	 * the bar up out of the phone header and stops at `xl`, where the rail takes
	 * the job over.
	 *
	 * The header is this screen's own below `lg` and the app's bar above it. The
	 * screen is chrome-less on a phone because hard rule 7 says so, and that rule
	 * is about a tired thumb on a gym floor — it has nothing to say about a mouse
	 * at a desk, where a second bar stacked under the app's would be the only
	 * page in the app that looked different for no reason. FINISH is the same
	 * button either way; it is declared once below and rendered into whichever
	 * header is on screen.
	 */
	let { data }: PageProps = $props();

	// Taken from the shared holder when one is live, begun otherwise: the
	// session has to outlive this page, so walking to Exercises mid-workout and
	// back lands in the same workout — and so the nav bars can read the same
	// object to swap Start for Workout. After a reload the holder is empty and
	// `data.resume` carries the snapshot, so beginning *is* the resume.
	// svelte-ignore state_referenced_locally
	const session = activeWorkout.session ?? activeWorkout.begin(data.history, data.resume);

	/**
	 * Persistence, as a side effect of existing: `$state.snapshot` reads every
	 * leaf of the tree synchronously, so this effect tracks all of them and
	 * re-runs on any mutation — a committed set, a reorder, a removal. The
	 * write is fire-and-forget; the screen never waits on IndexedDB, per the
	 * loop rule.
	 */
	$effect(() => {
		const snapshot = {
			workout: $state.snapshot(session.workout),
			activeSetId: session.activeSetId
		};

		void data.store.saveSnapshot(snapshot);
	});

	/**
	 * No ceremony, one decision: a session with logged sets becomes a record,
	 * a session with none is discarded — nothing was lifted, and an empty
	 * workout in history would hint nothing and count nothing. Either way the
	 * snapshot is cleared, sync is nudged if an account exists, and the screen
	 * hands back to Start — the holder emptied first, so Start's reroute into
	 * a live workout finds nothing to bounce off.
	 */
	async function finishSession() {
		if (session.hasLoggedSets) {
			await data.store.finishWorkout($state.snapshot(session.workout), Date.now());
		}

		await data.store.clearSnapshot();

		if (data.user) {
			syncSoon(data.user.id);
		}

		activeWorkout.finish();
		await goto('/start');
	}

	const groups = $derived(groupsWithMeta(session.workout, catalogById));

	let overview = $state(false);

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
		if (swapping === null) {
			return;
		}

		session.swapExercise(swapping, exerciseId);
		swapping = null;
	}

	function removeExercise() {
		if (swapping === null) {
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
		if (optionsSetId === null) {
			return;
		}

		session.removeSet(optionsSetId);
		optionsSetId = null;
	}

	// The bar's right-hand slot, given back on the way out — leaving it set would
	// carry FINISH onto Exercises, which is a button that resets a workout
	// sitting on a screen that has none.
	const bar = appBarSlot();

	$effect(() => {
		bar.action = barActions;

		return () => {
			bar.action = null;
		};
	});
</script>

<!-- Declared once and rendered twice — into this screen's own header on a phone,
     and into the app bar's slot on a desk. Finish has no ceremony: no summary,
     no confetti, one question and out. What follows the question is
     `finishSession` — the session recorded or discarded, and Start, where a
     second run is one tap away. -->
{#snippet finish()}
	<Button variant="chrome" caps onclick={() => (finishing = true)}>FINISH</Button>
{/snippet}

<!-- What the bar carries, which is FINISH and — until the rail arrives at `xl` —
     the phone's overview button beside it. Between `lg` and `xl` the bar is on
     screen and the rail is not, and the sheet is the only place in the app a set
     can be jumped to or an exercise dragged into a different order. Above `xl`
     the rail is that place, and this half of the slot goes away with it. -->
{#snippet barActions()}
	<div class="flex shrink-0 items-center gap-2">
		<button
			type="button"
			aria-label="Session overview"
			onclick={() => (overview = true)}
			class="grid min-h-chrome w-10 place-items-center rounded-full border border-line
				text-ink-muted focus-ring hover:bg-surface-2 active:bg-surface-2 xl:hidden"
		>
			<Stack size={18} />
		</button>

		{@render finish()}
	</div>
{/snippet}

<svelte:head>
	<title>Workout | Kilorep</title>
</svelte:head>

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

	<div class="relative flex min-h-0 flex-1">
		<!-- The session list, floating in the margin the window has left over.
		     Taken out of the flow on purpose: the pane below is the full width of
		     the window and scrolls at its edge exactly as every other screen does,
		     which is the whole reason the set rows land on the same pixel here as
		     they do on Exercises. A rail with a width would move them, and used to.

		     `left` is where the gutter runs out: half the window, back the 384px
		     half-cap of the column, back 32px of air, back the card. 39rem is those
		     three added up, and they are the only numbers in this layout.

		     `inset-y-0` is the pane's height and nothing more, so `max-h-full` on
		     the card is exact — a session longer than the window scrolls inside the
		     card rather than off the bottom of it. It is a card and not a pane: the
		     height of what is in it, no edge borrowed from the window, and no
		     shadow, which in this app means something has left the page.

		     `xl` and not `lg`, which is the app's breakpoint everywhere else: a
		     768px column centred in the window leaves (w − 768) / 2 a side, and 240
		     of that does not exist until 1280px. See `app.css`. -->
		<aside class="absolute inset-y-0 left-[calc(50%-39rem)] hidden w-52 py-3 xl:block">
			<div class="max-h-full overflow-y-auto rounded-xl border border-line-soft bg-surface p-2">
				<SessionList
					{groups}
					activeSetId={session.activeSetId}
					onjump={(id) => session.select(id)}
					onfocus={(id) => session.select(id)}
					oninsert={() => (insertOpen = true)}
					onreorder={(entryId, index) => session.moveEntry(entryId, index)}
				/>
			</div>
		</aside>

		<main class="min-h-0 flex-1 overflow-y-auto py-3 pb-safe-b">
			<!-- Capped and centred in the window, which is the same box the bar
			     centres its own contents in — so the wordmark and FINISH land over
			     the set rows, and Exercises' column lands over both.

			     The gutter goes inside the cap, never on the pane around it: the
			     bar puts its own there too, and padding on opposite sides of the
			     same cap is how the two columns end up 12px out of true. -->
			<div class="column-content flex flex-col gap-7 px-3">
				{#each groups as group (group.id)}
					<ExerciseBlock
						meta={group.meta}
						cursors={group.cursors}
						history={data.history}
						activeSetId={session.activeSetId}
						oncommit={(w, r) => session.commit(w, r)}
						ondraft={(id, w, r) => session.draft(id, w, r)}
						onselect={(id) => session.select(id)}
						onadd={() => session.addSet(group.cursors[0].exercise.id)}
						onoptions={options}
						onexercise={() => exerciseOptions(group.entryId)}
					/>
				{/each}

				<!-- The empty session: with no templates yet, every workout begins as
				     nothing, and the insert sheet is how everything arrives. It is also
				     where a session lands when its last exercise is removed, which is
				     the same state and needs no second wording. -->
				{#if groups.length === 0}
					<EmptyState title="Empty session" description="Add an exercise to start logging.">
						{#snippet icon()}
							<Stack size={26} />
						{/snippet}
						{#snippet action()}
							<Button variant="commit" onclick={() => (insertOpen = true)}>Add exercise</Button>
						{/snippet}
					</EmptyState>
				{:else}
					<!-- The way in for an exercise the plan did not hold, at the place the
					     session runs out — the rail and the overview both have one, and
					     neither is where a thumb that has just logged the last set is
					     looking. Above Finish, because a session grows before it ends.

					     The same dashed silhouette as the block's add-set row: the session
					     grows by one of the shape it already stacks, one size up. `+` is a
					     character, per the icons README. -->
					<button
						type="button"
						onclick={() => (insertOpen = true)}
						class="grid min-h-row place-items-center rounded-xl border border-dashed border-line
							text-ink-muted focus-ring hover:bg-surface-2 active:bg-surface-2"
					>
						<span class="label-caps">+ Add exercise</span>
					</button>

					<!-- Under the session rather than instead of it. Every block keeps its
					     add-set row while this is on screen, which is the only way a set
					     added after the last one was logged is reachable at all — and the
					     workout you just finished is still there to look at.

					     It carries no button of its own any more: Finish is below, always,
					     and two of them stacked would be the screen asking twice. -->
					{#if session.finished}
						<EmptyState title="Every set logged" description="Nothing left in this session.">
							{#snippet icon()}
								<Check size={26} />
							{/snippet}
						</EmptyState>
					{/if}

					<!-- The end of the session, where a session ends. The header keeps its
					     FINISH for the thumb that never scrolls down here; this is for the
					     one that has just logged the last set and is already looking at the
					     bottom of the page.

					     Filled only once nothing is left owed, because `Button`'s standing
					     rule is one filled button per screen and while the loop is running
					     that button is `Log set`. -->
					<Button
						variant={session.finished ? 'commit' : 'secondary'}
						class="w-full"
						onclick={() => (finishing = true)}
					>
						Finish
					</Button>
				{/if}
			</div>
		</main>
	</div>
</div>

<OverviewSheet
	bind:open={overview}
	{groups}
	activeSetId={session.activeSetId}
	onjump={(id) => session.select(id)}
	oninsert={() => (insertOpen = true)}
	onreorder={(entryId, index) => session.moveEntry(entryId, index)}
/>

<ExercisePickerSheet
	bind:open={insertOpen}
	title="Add exercise"
	onpick={(id) => session.addExercise(id)}
/>

<!-- The same picker, asking a different question. It opens as the options sheet
     closes, the way the overview already hands over to the insert. -->
<ExercisePickerSheet bind:open={swapOpen} title="Swap exercise" onpick={swapPick} />

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
