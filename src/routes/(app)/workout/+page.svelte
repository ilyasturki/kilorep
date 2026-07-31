<script lang="ts">
	import { catalogById } from '$lib/catalog';
	import { history } from '$lib/domain/fixture';
	import { appBarSlot } from '$lib/nav/bar.svelte';
	import { groupsWithMeta } from '$lib/workout/groups';
	import { WorkoutSession } from '$lib/workout/session.svelte';
	import ExerciseBlock from '$lib/workout/ExerciseBlock.svelte';
	import InsertSheet from '$lib/workout/InsertSheet.svelte';
	import OverviewSheet from '$lib/workout/OverviewSheet.svelte';
	import SessionList from '$lib/workout/SessionList.svelte';
	import SetOptionsSheet from '$lib/workout/SetOptionsSheet.svelte';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Check from '$lib/ui/icons/Check.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';

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
	 * Two panes from `lg` up: a rail holding the session list the sheet holds on
	 * a phone, and the pane being logged into. There is no overview button above
	 * `lg`, because there is nothing left for it to open.
	 *
	 * The header is this screen's own below `lg` and the app's bar above it. The
	 * screen is chrome-less on a phone because hard rule 7 says so, and that rule
	 * is about a tired thumb on a gym floor — it has nothing to say about a mouse
	 * at a desk, where a second bar stacked under the app's would be the only
	 * page in the app that looked different for no reason. FINISH is the same
	 * button either way; it is declared once below and rendered into whichever
	 * header is on screen.
	 */
	const session = new WorkoutSession();

	const groups = $derived(groupsWithMeta(session.workout, catalogById));

	let overview = $state(false);

	// One insert sheet for the screen, reached from the rail and from the
	// overview alike — the overview closes itself first, so the two are never
	// open at once.
	let insertOpen = $state(false);

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

	// The bar's right-hand slot, and the offset its column needs to clear the
	// rail. Both are given back on the way out — leaving them set would carry
	// FINISH onto Exercises, which is a button that resets a workout sitting on
	// a screen that has none.
	const bar = appBarSlot();

	$effect(() => {
		bar.action = finish;
		bar.railed = true;

		return () => {
			bar.action = null;
			bar.railed = false;
		};
	});
</script>

<!-- Declared once and rendered twice — into this screen's own header on a phone,
     and into the app bar's slot on a desk. Finish is instant and has no
     ceremony: no summary, no confetti. Here it resets the fixture, which is also
     what makes a second run one tap away. -->
{#snippet finish()}
	<Button variant="chrome" caps onclick={() => session.reset()}>FINISH</Button>
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

	<div class="flex min-h-0 flex-1">
		<!-- The sheet's contents, standing still. It scrolls on its own so a long
		     session can be walked without moving the set being logged. -->
		<aside
			class="hidden w-60 shrink-0 overflow-y-auto border-r border-line-soft bg-surface
				px-2 py-3 lg:block"
		>
			<SessionList
				{groups}
				activeSetId={session.activeSetId}
				onjump={(id) => session.select(id)}
				oninsert={() => (insertOpen = true)}
				onreorder={(entryId, index) => session.moveEntry(entryId, index)}
			/>
		</aside>

		<main class="min-h-0 flex-1 overflow-y-auto py-3 pb-safe-b">
			<!-- Capped and centred inside the pane, which is also where the bar's
			     column centres itself once `railed` is set — the wordmark and
			     FINISH land over the set rows rather than 120px to their left.

			     The gutter goes inside the cap, never on the pane around it: the
			     bar puts its own there too, and padding on opposite sides of the
			     same cap is how the two columns end up 12px out of true. -->
			<div class="column-content flex flex-col gap-7 px-3">
				{#each groups as group (group.id)}
					<ExerciseBlock
						meta={group.meta}
						cursors={group.cursors}
						{history}
						activeSetId={session.activeSetId}
						oncommit={(w, r) => session.commit(w, r)}
						onselect={(id) => session.select(id)}
						onadd={() => session.addSet(group.cursors[0].exercise.id)}
						onoptions={options}
					/>
				{/each}

				<!-- Under the session rather than instead of it. Every block keeps its
				     add-set row while this is on screen, which is the only way a set
				     added after the last one was logged is reachable at all — and the
				     workout you just finished is still there to look at. -->
				{#if session.finished}
					<EmptyState title="Every set logged" description="Nothing left in this session.">
						{#snippet icon()}
							<Check size={26} />
						{/snippet}
						{#snippet action()}
							<Button variant="commit" onclick={() => session.reset()}>Finish</Button>
						{/snippet}
					</EmptyState>
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

<InsertSheet bind:open={insertOpen} onadd={(id) => session.addExercise(id)} />

<SetOptionsSheet
	bind:open={optionsOpen}
	cursor={optionsCursor}
	removable={optionsGroup !== null && optionsGroup.cursors.length > 1}
	onremove={removeSet}
/>
