<script lang="ts">
	import { completedSetCount, exerciseCount, workoutTitle } from '$lib/history/label';
	import type { FinishedWorkout } from '$lib/store/derive';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import ClockCounterClockwise from '$lib/ui/icons/ClockCounterClockwise.svelte';

	import type { PageProps } from './$types';

	/**
	 * Every finished session, newest first — the order a lifter asks "what did
	 * I do last time" in. Rows only: the reading happens on the detail, and a
	 * list that tried to say more would just be a slower way to tap through.
	 *
	 * All of it at once, no paging: the store's list is already the whole
	 * history in memory, and a year of lifting is hundreds of rows, not
	 * millions. The day paging earns its complexity is the day the store
	 * needs a date index too.
	 */
	let { data }: PageProps = $props();

	const workouts = $derived(data.workouts.toReversed());

	const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

	/**
	 * How big the session was, in the two numbers a lifter scans for: how much
	 * was trained, and how much work it took. How long it took is deliberately
	 * absent — a session is a day in this app, not a stopwatch reading, and the
	 * clock a record carries is plumbing (the sort key, the finished marker)
	 * rather than something to answer for.
	 */
	function meta(workout: FinishedWorkout): string {
		const exercises = exerciseCount(workout);
		const sets = completedSetCount(workout);

		return [
			exercises === 1 ? '1 exercise' : `${exercises} exercises`,
			sets === 1 ? '1 set' : `${sets} sets`
		].join(' · ');
	}
</script>

<svelte:head>
	<title>History | Kilorep</title>
</svelte:head>

<main class="column-content flex min-h-full flex-col gap-4 px-3 pt-safe-t pb-4 lg:pt-3">
	<!-- Gone from `lg` up, same bargain as Exercises: the bar above already
	     says History in the lit tab. -->
	<header class="px-1 pt-6 lg:hidden">
		<h1 class="text-2xl font-extrabold tracking-tight">History</h1>
	</header>

	{#if workouts.length === 0}
		<!-- Not a dead end: the tab that records sessions points at the tab that
		     starts them. Outlined — the lit commit belongs to Workout's own Start. -->
		<EmptyState title="No workouts yet" description="Finish a session and it lands here.">
			{#snippet icon()}
				<ClockCounterClockwise size={24} />
			{/snippet}
			{#snippet action()}
				<Button href="/workout">Start a workout</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<section class="list-group">
			{#each workouts as workout (workout.id)}
				<ListRow
					title={workoutTitle(workout, data.templates)}
					meta={meta(workout)}
					href="/history/{workout.id}"
				>
					{#snippet trailing()}
						{day.format(workout.startedAt)}
					{/snippet}
				</ListRow>
			{/each}
		</section>
	{/if}
</main>
