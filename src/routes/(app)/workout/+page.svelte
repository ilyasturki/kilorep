<script lang="ts">
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import { exercises, history } from '$lib/domain/fixture';
	import { groupsWithMeta } from '$lib/workout/groups';
	import type { Group } from '$lib/workout/groups';
	import { REST_SECONDS, WorkoutSession } from '$lib/workout/session.svelte';
	import ExerciseBlock from '$lib/workout/ExerciseBlock.svelte';
	import OverviewSheet from '$lib/workout/OverviewSheet.svelte';
	import RestChip from '$lib/workout/RestChip.svelte';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Check from '$lib/ui/icons/Check.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';

	/**
	 * The workout screen, in both of the layouts PRODUCT.md refuses to choose
	 * between from a screen.
	 *
	 * `?mode=focused` renders one exercise at a time; anything else renders the
	 * whole session stacked. Everything below the container — the set rows, the
	 * active editor, the hints, the rest chip, the overview — is the same code in
	 * both, so a run through the fixture measures the container and nothing else.
	 * Two bookmarks, zero toggle UI on the screen being judged.
	 *
	 * The loser is deleted in one commit once the run is in.
	 */
	const session = new WorkoutSession();

	const mode = $derived(page.url.searchParams.get('mode') === 'focused' ? 'focused' : 'list');

	const groups = $derived(groupsWithMeta(session.workout, exercises));

	const activeIndex = $derived(
		groups.findIndex((g) => g.cursors.some((c) => c.set.id === session.activeSetId))
	);

	const activeGroup = $derived(activeIndex < 0 ? null : groups[activeIndex]);

	let overview = $state(false);
</script>

<!-- Both containers render this, wired once. The header comment above promises
     everything below the container is held constant; written out twice, a prop
     added to `ExerciseBlock` reaches one mode and the comparison quietly stops
     being like-for-like. `autoscroll` is the one deliberate difference. -->
{#snippet block(group: Group, autoscroll: boolean)}
	<ExerciseBlock
		meta={group.meta}
		cursors={group.cursors}
		{history}
		activeSetId={session.activeSetId}
		{autoscroll}
		oncommit={(w, r) => session.commit(w, r)}
		onselect={(id) => session.select(id)}
	/>
{/snippet}

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
				<span class="label-caps">
					{#if mode === 'focused' && activeGroup !== null}
						Exercise {activeIndex + 1} of {groups.length}
					{:else}
						Workout
					{/if}
				</span>
			</div>

			<!-- Finish is instant and has no ceremony: no summary, no confetti. Here
			     it resets the fixture, which is also what makes a second comparison
			     run one tap away. -->
			<Button variant="chrome" caps onclick={() => session.reset()}>FINISH</Button>
		</div>

		{#if session.restStartedAt !== null}
			<div class="px-3 pb-2">
				<RestChip
					startedAt={session.restStartedAt}
					seconds={REST_SECONDS}
					onskip={() => session.skipRest()}
				/>
			</div>
		{/if}
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
		{:else if mode === 'focused' && activeGroup !== null}
			<!-- Keyed on the exercise, not the set: committing set 2 of 4 must not
			     re-animate the screen, but crossing into the next exercise replaces
			     everything and has to say so. -->
			{#key activeGroup.meta.id}
				<div in:fly={{ x: 28, duration: 180 }}>
					{@render block(activeGroup, false)}
				</div>
			{/key}
		{:else}
			<div class="flex flex-col gap-7">
				{#each groups as group (group.meta.id)}
					{@render block(group, true)}
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
