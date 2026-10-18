<script lang="ts">
	import { formatWhen, trainedWhen, workoutMeta } from '$lib/history/label';
	import { page } from '$app/state';

	import { fillAppBar, openedFrom } from '$lib/nav/bar.svelte';
	import { addressOf } from '$lib/nav/entries';
	import { templateTitle } from '$lib/templates/plan';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import ClockCounterClockwise from '$lib/ui/icons/ClockCounterClockwise.svelte';

	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const title = $derived(templateTitle(data.template));

	const sessions = $derived(data.workouts.toReversed());

	const now = Date.now();

	const line = $derived.by(() => {
		const counted = sessions.length === 1 ? '1 session' : `${sessions.length} sessions`;

		return `${counted} · ${trainedWhen(sessions[0]?.startedAt ?? null, now).long}`;
	});

	fillAppBar(() => ({ title }));
</script>

<svelte:head>
	<title>{title} history | Kilorep</title>
</svelte:head>

<main class="column-content flex min-h-full flex-col gap-4 px-3 pt-3 pb-4">
	{#if sessions.length === 0}
		<EmptyState
			title="Never trained"
			description="Sessions started from this template land here, newest first."
		>
			{#snippet icon()}
				<ClockCounterClockwise size={24} />
			{/snippet}
		</EmptyState>
	{:else}
		<p class="px-1 text-md font-bold text-ink-faint">{line}</p>

		<section class="list-group">
			{#each sessions as workout (workout.id)}
				{@const when = formatWhen(workout.startedAt, now)}

				<ListRow
					title={when.long}
					meta={workoutMeta(workout)}
					href={openedFrom(`/history/${workout.id}`, addressOf(page.url))}
				/>
			{/each}
		</section>
	{/if}
</main>
