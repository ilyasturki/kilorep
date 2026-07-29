<script lang="ts">
	import { exercises, history } from '$lib/domain/fixture';
	import { groupsWithMeta } from '$lib/workout/groups';
	import { WorkoutSession } from '$lib/workout/session.svelte';
	import ExerciseBlock from '$lib/workout/ExerciseBlock.svelte';
	import OverviewSheet from '$lib/workout/OverviewSheet.svelte';
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
	 */
	const session = new WorkoutSession();

	const groups = $derived(groupsWithMeta(session.workout, exercises));

	let overview = $state(false);
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
					border-line text-ink-muted focus-ring hover:bg-surface-2 active:bg-surface-2"
			>
				<Stack size={20} />
			</button>

			<div class="min-w-0 flex-1 text-center">
				<span class="label-caps">Workout</span>
			</div>

			<!-- Finish is instant and has no ceremony: no summary, no confetti. Here
			     it resets the fixture, which is also what makes a second run one tap
			     away. -->
			<Button variant="chrome" caps onclick={() => session.reset()}>FINISH</Button>
		</div>
	</header>

	<main class="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-safe-b">
		{#if session.finished}
			<EmptyState title="Every set logged" description="Nothing left in this session.">
				{#snippet icon()}
					<Check size={26} />
				{/snippet}
				{#snippet action()}
					<Button variant="commit" onclick={() => session.reset()}>Finish</Button>
				{/snippet}
			</EmptyState>
		{:else}
			<div class="flex flex-col gap-7">
				{#each groups as group (group.meta.id)}
					<ExerciseBlock
						meta={group.meta}
						cursors={group.cursors}
						{history}
						activeSetId={session.activeSetId}
						oncommit={(w, r) => session.commit(w, r)}
						onselect={(id) => session.select(id)}
					/>
				{/each}
			</div>
		{/if}
	</main>
</div>

<OverviewSheet
	bind:open={overview}
	{groups}
	activeSetId={session.activeSetId}
	onjump={(id) => session.select(id)}
/>
