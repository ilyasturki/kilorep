<script lang="ts">
	import { catalogById } from '$lib/catalog';
	import { history } from '$lib/domain/fixture';
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
	 * Two panes from `lg` up. The header spans both at every width — one header,
	 * with FINISH in the same corner on a phone and on a desk — and the rail
	 * below it holds the session list the sheet holds on a phone. There is no
	 * overview button above `lg`, because there is nothing left for it to open.
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
</script>

<svelte:head>
	<title>Workout | Kilorep</title>
</svelte:head>

<div class="flex h-dvh flex-col bg-canvas text-ink">
	<header class="shrink-0 border-b border-line-soft bg-surface pt-safe-t">
		<div class="flex items-center gap-2 px-3 py-2">
			<button
				type="button"
				aria-label="Session overview"
				onclick={() => (overview = true)}
				class="grid min-h-chrome w-11 shrink-0 place-items-center rounded-full border
					border-line text-ink-muted focus-ring hover:bg-surface-2 active:bg-surface-2
					lg:hidden"
			>
				<Stack size={20} />
			</button>

			<!-- Centred between the two controls on a phone; with the overview
			     button gone above `lg` there is nothing on the left to centre
			     against, so it goes there instead of drifting. -->
			<div class="min-w-0 flex-1 text-center lg:pl-1 lg:text-left">
				<span class="label-caps">Workout</span>
			</div>

			<!-- Finish is instant and has no ceremony: no summary, no confetti. Here
			     it resets the fixture, which is also what makes a second run one tap
			     away. -->
			<Button variant="chrome" caps onclick={() => session.reset()}>FINISH</Button>
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
			/>
		</aside>

		<main class="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-safe-b">
			<!-- Capped and centred inside the pane. A set row stretched across a
			     1600px monitor puts the weight and the reps a hand apart, and the
			     pair has to be read as one thing. -->
			<div class="mx-auto flex max-w-3xl flex-col gap-7">
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
/>

<InsertSheet bind:open={insertOpen} onadd={(id) => session.addExercise(id)} />

<SetOptionsSheet
	bind:open={optionsOpen}
	cursor={optionsCursor}
	removable={optionsGroup !== null && optionsGroup.cursors.length > 1}
	onremove={removeSet}
/>
