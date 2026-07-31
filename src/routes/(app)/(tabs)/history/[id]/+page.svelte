<script lang="ts">
	import { goto } from '$app/navigation';

	import { catalogById } from '$lib/catalog';
	import { driftFrom, hasDrift, hasSetDrift } from '$lib/domain/drift';
	import type { SetDrift } from '$lib/domain/drift';
	import type { WorkoutExercise, WorkoutSet } from '$lib/domain/workout';
	import { formatDuration, workoutTitle } from '$lib/history/label';
	import { syncSoon } from '$lib/sync/client';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Button from '$lib/ui/Button.svelte';
	import SetMark from '$lib/ui/SetMark.svelte';

	import type { PageProps } from './$types';

	/**
	 * One past workout, read as it was lifted: every set in session order,
	 * warmups and unchecked slots included, because the record is the session
	 * and a view that tidied it would be editing by omission. Read-only plus
	 * one exit — delete — which is the only correction this build offers.
	 *
	 * Drift is against the template as it stands today (see `domain/drift`),
	 * and only when that template still exists: badges on the groups that
	 * deviated, a dashed section for what was planned and never done, and
	 * nothing at all when there was never a plan to hold the session against.
	 */
	let { data }: PageProps = $props();

	const workout = $derived(data.workout);
	const template = $derived(data.template);

	const title = $derived(workoutTitle(workout, template === null ? [] : [template]));
	const drift = $derived(template === null ? null : driftFrom(workout, template));

	const groups = $derived(
		workout.entries.flatMap((entry) =>
			entry.exercises.map((exercise) => ({
				id: exercise.id,
				meta: catalogById[exercise.exerciseId],
				exercise
			}))
		)
	);

	// Year included, unlike the list's day-and-month: the list is scanned, the
	// detail is consulted, and "12 Jan" stops answering which January soon.
	const when = new Intl.DateTimeFormat('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});

	/**
	 * Working sets numbered past the warmups, the same count "working set 2"
	 * means everywhere else — SetMark hides the index behind a W or a check
	 * anyway, but the pending discs read theirs.
	 */
	function rowsOf(exercise: WorkoutExercise): { set: WorkoutSet; index: number }[] {
		let working = 0;

		return exercise.sets.map((set) => ({
			set,
			index: set.type === 'warmup' ? 0 : (working += 1)
		}));
	}

	function statusOf(set: WorkoutSet): 'done' | 'warmup' | 'pending' {
		if (set.type === 'warmup') {
			return 'warmup';
		}

		return set.completed ? 'done' : 'pending';
	}

	function driftMarks(setDrift: SetDrift): string[] {
		const marks: string[] = [];

		if (setDrift.added > 0) {
			marks.push(setDrift.added === 1 ? '+1 set' : `+${setDrift.added} sets`);
		}

		if (setDrift.removed > 0) {
			marks.push(setDrift.removed === 1 ? '−1 set' : `−${setDrift.removed} sets`);
		}

		if (setDrift.retargeted > 0) {
			marks.push('target moved');
		}

		return marks;
	}

	let deleteOpen = $state(false);

	async function deleteWorkout() {
		await data.store.deleteWorkout(workout.id, Date.now());

		if (data.user) {
			syncSoon(data.user.id);
		}

		await goto('/history');
	}
</script>

<svelte:head>
	<title>{title} | Kilorep</title>
</svelte:head>

<main class="column-content flex min-h-full flex-col gap-5 px-3 pt-safe-t pb-4 lg:pt-0">
	<header class="flex flex-col gap-3 pt-3">
		<!-- `‹` is a character, like ListRow's `›` — the subset carries it. -->
		<a
			href="/history"
			aria-label="Back to history"
			class="grid min-h-chrome w-11 place-items-center self-start rounded-full border
				border-line text-xl leading-none text-ink-muted focus-ring hover:bg-surface-2
				active:bg-surface-2"
		>
			‹
		</a>

		<div class="flex flex-col gap-1 px-1">
			<h1 class="text-2xl font-extrabold tracking-tight">{title}</h1>
			<p class="text-md font-bold text-ink-faint">
				{when.format(workout.startedAt)} · {formatDuration(workout.startedAt, workout.finishedAt)}
				{#if drift !== null && !hasDrift(drift)}· as planned{/if}
			</p>
		</div>
	</header>

	<div class="flex flex-1 flex-col gap-3">
		{#each groups as group (group.id)}
			<section class="flex flex-col gap-2 rounded-2xl border border-line-soft bg-surface p-3">
				<div class="flex items-center gap-2 px-1">
					<div class="min-w-0 flex-1">
						<h2 class="truncate text-lg font-extrabold tracking-tight text-ink">
							{group.meta.name}
						</h2>
						<p class="truncate text-sm font-bold text-ink-faint">{group.meta.equipment}</p>
					</div>

					{#if drift !== null}
						{@const setDrift = drift.matched[group.id]}
						{#if setDrift === undefined}
							<Badge>Unplanned</Badge>
						{:else if hasSetDrift(setDrift)}
							{#each driftMarks(setDrift) as mark (mark)}
								<Badge>{mark}</Badge>
							{/each}
						{/if}
					{/if}
				</div>

				{#each rowsOf(group.exercise) as { set, index } (set.id)}
					<div class="flex min-h-11 items-center gap-3 px-1">
						<SetMark status={statusOf(set)} {index} />

						<span
							class={[
								'flex-1 text-md tracking-numeral',
								set.completed ? 'font-extrabold text-ink' : 'font-bold text-ink-faint'
							]}
						>
							{set.weight !== null && set.reps !== null ? `${set.weight} × ${set.reps}` : '—'}
						</span>

						{#if set.plannedReps !== null && set.reps !== set.plannedReps}
							<span class="shrink-0 text-sm font-bold text-ink-faint">
								planned {set.plannedReps}
							</span>
						{/if}
					</div>
				{/each}
			</section>
		{/each}

		{#if drift !== null && drift.missing.length > 0}
			<!-- The dashed silhouette the app draws for absence: planned slots the
			     session never filled. Keyed by index — the same exercise can be
			     planned, and skipped, twice. -->
			<section class="flex flex-col gap-1 rounded-2xl border border-dashed border-line p-3">
				<h2 class="px-1 label-caps text-ink-faint">Planned, not done</h2>
				{#each drift.missing as exerciseId, slot (slot)}
					<p class="px-1 text-md font-bold text-ink-muted">
						{catalogById[exerciseId]?.name ?? exerciseId}
					</p>
				{/each}
			</section>
		{/if}

		<Button variant="destructive" class="self-center" onclick={() => (deleteOpen = true)}>
			Delete workout
		</Button>
	</div>
</main>

<AlertDialog
	bind:open={deleteOpen}
	title="Delete this workout?"
	description="Its sets leave history, hints and records for good, on every device."
	confirmLabel="Delete"
	onconfirm={() => void deleteWorkout()}
/>
