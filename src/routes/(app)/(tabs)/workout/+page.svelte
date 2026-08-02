<script lang="ts">
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
	import Barbell from '$lib/ui/icons/Barbell.svelte';
	import Check from '$lib/ui/icons/Check.svelte';
	import Gear from '$lib/ui/icons/Gear.svelte';
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
	 * screen is chrome-less on a phone *while a session is live* because hard
	 * rule 7 says so, and that rule is about a tired thumb on a gym floor — it
	 * has nothing to say about a mouse at a desk, where a second bar stacked
	 * under the app's would be the only page in the app that looked different
	 * for no reason. The `(tabs)` layout reads the same holder to stand its bar
	 * down. FINISH is the same button either way; it is declared once below and
	 * rendered into whichever header is on screen.
	 *
	 * This screen is also home: with no session running it is the place one
	 * starts, not a page that mints a workout by being looked at. The Start page
	 * that used to hold that job is gone — it was a button and a reroute, and
	 * the reroute only knew about the in-memory holder, so a reload left the
	 * bars claiming no workout existed while a half-logged one sat in the store.
	 * One address cannot disagree with itself.
	 */
	let { data }: PageProps = $props();

	// The template editor's handoff: it writes the snapshot, empties the holder
	// and navigates here, so beginning from `data.resume` *is* the start. A cold
	// boot resumes in the `(app)` layout's load instead, before any page runs —
	// by this line the holder is usually already live.
	// svelte-ignore state_referenced_locally
	if (activeWorkout.session === null && data.resume !== null) {
		activeWorkout.begin(data.history, data.resume);
	}

	// The holder's, not this page's: the session has to outlive the page so
	// walking to Exercises mid-workout and back lands in the same workout — and
	// so the nav bars can read the same object for the live dot. Null is the
	// idle posture, and only an explicit tap leaves it.
	const session = $derived(activeWorkout.session);

	function startEmpty() {
		activeWorkout.begin(data.history);
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
	 * snapshot is cleared, sync is nudged if an account exists, and the screen
	 * settles back into its idle posture — same address, where a second run is
	 * one tap away.
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
	}

	const groups = $derived(session === null ? [] : groupsWithMeta(session.workout, catalogById));

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
	// sitting on a screen that has none. The idle posture fills it with the gear
	// instead: home is where PRODUCT.md pins "gear to Settings", and this screen
	// is home now.
	const bar = appBarSlot();

	$effect(() => {
		bar.action = session === null ? gear : finish;

		return () => {
			bar.action = null;
		};
	});
</script>

{#snippet gear()}
	<a
		href="/settings"
		aria-label="Settings"
		class="grid min-h-chrome w-11 place-items-center rounded-full border border-line
			text-ink-muted focus-ring hover:bg-surface-2 active:bg-surface-2"
	>
		<Gear size={20} />
	</a>
{/snippet}

<!-- Declared once and rendered twice — into this screen's own header on a phone,
     and into the app bar's slot on a desk. Finish has no ceremony: no summary,
     no confetti, one question and out. What follows the question is
     `finishSession` — the session recorded or discarded, and the idle posture,
     where a second run is one tap away. -->
{#snippet finish()}
	<Button variant="chrome" caps onclick={() => (finishing = true)}>FINISH</Button>
{/snippet}

<svelte:head>
	<title>Workout | Kilorep</title>
</svelte:head>

{#if session === null}
	<!-- The idle posture: home, wearing the header the Start page used to wear.
	     One act and a route — the templates themselves live on their own tab,
	     because a list to read standing still does not belong on the screen
	     pressed mid-stride, but the copy naming them owes the thumb a way there
	     that is not hunting the tab bar. Nothing begins until the commit says
	     so; a session minted by navigation was how "Resume workout" appeared
	     over a workout nobody had started, and the outlined route below it is
	     only a walk to the list. -->
	<main class="min-h-0 flex-1 overflow-y-auto">
		<div class="column-content flex min-h-full flex-col gap-5 px-3 pt-safe-t pb-4 lg:pt-0">
			<header class="flex items-start justify-between gap-3 pt-10 lg:hidden">
				<h1 class="text-2xl font-extrabold tracking-tight">Kilorep</h1>

				{@render gear()}
			</header>

			<EmptyState
				class="pb-16"
				title="No workout running"
				description="Start empty and build as you go, or begin from a template."
			>
				{#snippet icon()}
					<Barbell size={24} />
				{/snippet}
				{#snippet action()}
					<div class="flex flex-col items-center gap-3">
						<Button variant="commit" onclick={startEmpty}>Start empty workout</Button>
						<Button href="/templates">Start from a template</Button>
					</div>
				{/snippet}
			</EmptyState>
		</div>
	</main>
{:else}
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

		     `left` is where the gutter runs out: half the window, back the 288px
		     half-cap of the column, back 16px of air, back the card. 32rem is those
		     three added up at `lg`, 37rem at `xl`, and they are the only numbers in
		     this layout.

		     Two widths, because 208px is a card that truncates half the catalog —
		     Incline Dumbbell Press has never once fitted in it — and the fix is not
		     a wider rail everywhere but a rail that grows when the window can pay
		     for it. At `xl` it takes 288px and the gutter still covers it; below
		     that the window genuinely has no more to give and the truncation is
		     the honest price of the rail existing at all.

		     `inset-y-0` is the pane's height and nothing more, so `max-h-full` on
		     the card is exact — a session longer than the window scrolls inside the
		     card rather than off the bottom of it. It is a card and not a pane: the
		     height of what is in it, no edge borrowed from the window, and no
		     shadow, which in this app means something has left the page.

		     `lg`, the app's one breakpoint, and the cap is what pays for that: at
		     `lg` the column steps down to 576px, and 576 + 2 × (208 + 16) = 1024
		     exactly — the rail fits the moment the top bar exists, and no laptop
		     is left with the bar but not the rail. The 288px width waits for the
		     1184px that 576 + 2 × (288 + 16) makes, first cleared at `xl` rather
		     than at a breakpoint of its own. See `app.css`. -->
			<aside
				class="absolute inset-y-0 left-[calc(50%-32rem)] hidden w-52 py-3
					lg:block xl:left-[calc(50%-37rem)] xl:w-72"
			>
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

					     Filled only once nothing is left owed, because `Button`'s standing
					     rule is one filled button per screen and while the loop is running
					     that button is `Log set`. -->
						<Button
							variant={session.finished ? 'commit' : 'secondary'}
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
		lastPerformed={data.lastPerformed}
		onpick={(id) => session.addExercise(id)}
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
		onpick={swapPick}
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
