<script lang="ts">
	import { completedSetCount, exerciseCount, formatWhen, workoutTitle } from '$lib/history/label';
	import type { Workout } from '$lib/domain/workout';
	import { activeWorkout } from '$lib/workout/active.svelte';
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

	/**
	 * The session still being logged, pinned above the list.
	 *
	 * Read straight off the holder rather than through the load: it is module
	 * state the `(app)` layout refills from the snapshot before any load runs,
	 * so it is already true on the first frame, and a `depends` here would only
	 * buy a re-run that changes nothing this screen writes. The counts below it
	 * move as sets are checked on another screen, which is the point — this row
	 * is the running session, not a copy of it.
	 *
	 * It goes to `/workout/live`, not `/history/{id}`: there is no record yet.
	 * Which is also why it stands outside the list below rather than leading it
	 * — every row in that group opens a finished workout, and one row in the
	 * same card that went somewhere else would be a lie the card tells.
	 */
	const live = $derived(activeWorkout.session);

	// Captured once per mount, the idiom every read-only screen here uses. A
	// list left open across midnight keeps yesterday's wording until you
	// navigate, which is a smaller surprise than labels rewriting themselves
	// under a thumb.
	const now = Date.now();

	/**
	 * How big the session was, in the two numbers a lifter scans for: how much
	 * was trained, and how much work it took. How long it took is deliberately
	 * absent — a session is a day in this app, not a stopwatch reading, and the
	 * clock a record carries is plumbing (the sort key, the finished marker)
	 * rather than something to answer for.
	 *
	 * Takes a plain `Workout`, so the live row is described by the same
	 * sentence as the finished ones. A session with nothing checked yet reads
	 * `0 sets` honestly — warmups and unchecked sets never count, live or not.
	 */
	function meta(workout: Workout): string {
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

	{#if live !== null}
		<!-- Its own card, above the group and never inside it: this row resumes,
		     the rows below it read. The dot is the accent, which in this app means
		     "this logs a set" — the one thing on the screen that still does. -->
		<section class="list-group">
			<ListRow
				title={workoutTitle(live.workout, data.templates)}
				meta={meta(live.workout)}
				href="/workout/live"
			>
				{#snippet leading()}
					<span class="size-1.5 rounded-full bg-accent"></span>
				{/snippet}
				{#snippet trailing()}
					Now
				{/snippet}
			</ListRow>
		</section>
	{/if}

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
				{@const when = formatWhen(workout.startedAt, now)}

				<ListRow
					title={workoutTitle(workout, data.templates)}
					meta={meta(workout)}
					href="/history/{workout.id}"
				>
					<!-- Both spellings rendered, one hidden: the swap is `lg`, the app's
					     single shape breakpoint, and picking in CSS keeps the choice out
					     of a width the component would have to measure. -->
					{#snippet trailing()}
						<span class="lg:hidden">{when.short}</span>
						<span class="hidden lg:inline">{when.long}</span>
					{/snippet}
				</ListRow>
			{/each}
		</section>
	{/if}
</main>
