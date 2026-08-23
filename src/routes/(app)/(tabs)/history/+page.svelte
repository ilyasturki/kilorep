<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	import { formatWhen, workoutMeta, workoutTitle } from '$lib/history/label';
	import type { Workout } from '$lib/domain/workout';
	import { launchRepeat, repeatBlocked } from '$lib/history/repeat';
	import WorkoutRowMenu from '$lib/history/WorkoutRowMenu.svelte';
	import { fillAppBar } from '$lib/nav/bar.svelte';
	import { syncSoon } from '$lib/sync/client';
	import { activeWorkout } from '$lib/workout/active.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import ClockCounterClockwise from '$lib/ui/icons/ClockCounterClockwise.svelte';

	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const workouts = $derived(data.workouts.toReversed());

	const live = $derived(activeWorkout.session);

	const now = Date.now();

	let menuOpen = $state(false);
	let menuAnchor = $state<HTMLElement | null>(null);
	let held = $state<Workout | null>(null);

	function hold(anchor: HTMLElement, workout: Workout) {
		held = workout;
		menuAnchor = anchor;
		menuOpen = true;
	}

	let discardOpen = $state(false);
	let deleteOpen = $state(false);

	async function launch() {
		if (held !== null) {
			await launchRepeat(data.store, held);
		}
	}

	async function repeat() {
		if (await repeatBlocked(data.store)) {
			discardOpen = true;

			return;
		}

		await launch();
	}

	async function remove() {
		if (held === null) {
			return;
		}

		await data.store.deleteWorkout(held.id, Date.now());

		if (data.user) {
			syncSoon(data.user.id);
		}

		await invalidateAll();
	}

	fillAppBar(() => ({ title: 'History' }));
</script>

<svelte:head>
	<title>History | Kilorep</title>
</svelte:head>

<main class="column-content flex min-h-full flex-col gap-4 px-3 pt-3 pb-4">
	{#if live !== null}
		<section class="list-group">
			<ListRow
				title={workoutTitle(live.workout, data.templates)}
				meta={workoutMeta(live.workout)}
				href="/train/live"
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
		<EmptyState title="No workouts yet" description="Finish a session and it lands here.">
			{#snippet icon()}
				<ClockCounterClockwise size={24} />
			{/snippet}
			{#snippet action()}
				<Button href="/train">Start a workout</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<section class="list-group">
			{#each workouts as workout (workout.id)}
				{@const when = formatWhen(workout.startedAt, now)}

				<ListRow
					title={workoutTitle(workout, data.templates)}
					meta={workoutMeta(workout)}
					href="/history/{workout.id}"
					onhold={(anchor) => hold(anchor, workout)}
				>
					{#snippet trailing()}
						<span class="lg:hidden">{when.short}</span>
						<span class="hidden lg:inline">{when.long}</span>
					{/snippet}
				</ListRow>
			{/each}
		</section>
	{/if}
</main>

<WorkoutRowMenu
	bind:open={menuOpen}
	title={held === null ? '' : workoutTitle(held, data.templates)}
	anchor={menuAnchor}
	onrepeat={() => void repeat()}
	ondelete={() => (deleteOpen = true)}
/>

<AlertDialog
	bind:open={deleteOpen}
	title="Delete this workout?"
	description="Its sets leave history, hints and records for good, on every device."
	confirmLabel="Delete"
	onconfirm={() => void remove()}
/>

<AlertDialog
	bind:open={discardOpen}
	title="A workout is in progress"
	description="Repeating this workout discards it, logged sets and all. Finish it from the Workout tab to keep it."
	confirmLabel="Discard and start"
	onconfirm={() => void launch()}
/>
