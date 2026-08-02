<script lang="ts">
	import { catalog } from '$lib/catalog';
	import type { Exercise } from '$lib/domain/exercise';
	import { rawPr } from '$lib/domain/stats';
	import { familyOf } from '$lib/exercises/browse';
	import ExerciseIllustration from '$lib/exercises/ExerciseIllustration.svelte';
	import { lastSetLabel, lastSinceLabel, loadModeNote, ordinal } from '$lib/exercises/label';
	import Badge from '$lib/ui/Badge.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Calendar from '$lib/ui/icons/Calendar.svelte';

	import type { PageProps } from './$types';

	/**
	 * One exercise, read-only: what it is, the family around it, the raw best,
	 * the sessions behind it. Catalog entries are immutable and customs are a
	 * later slice, so the only actions here are navigations — the family links,
	 * and each history entry through to the workout it came from.
	 *
	 * The est-1RM trend is settled but deliberately absent: it is the app's
	 * first chart, and charting gets decided once, at the Dashboard, not
	 * smuggled in here as a one-off.
	 *
	 * History is the store's, derived from finished workouts on the way in.
	 */
	let { data }: PageProps = $props();

	const exercise = $derived(data.exercise);

	// Hints never cross the family's rows — the links exist exactly because
	// each one is its own history.
	const family = $derived(familyOf(catalog, exercise));

	// Oldest first in the data — the order `rawPr` reads; the screen wants
	// latest first.
	const past = $derived(data.past);
	const sessions = $derived(past.toReversed());

	const pr = $derived(rawPr(past));

	const loadNote = $derived(loadModeNote(exercise.loadMode));

	const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

	// Captured once per mount, like `ExerciseList`'s: `12d` is wrong for at most
	// a day, and a navigation remounts this screen.
	const now = Date.now();
</script>

<svelte:head>
	<title>{exercise.name} | Kilorep</title>
</svelte:head>

<!-- A family link is a choice between entries, so it reads like a catalog row:
     last time's best set under the name, how long since on the right, and
     nothing at all when the entry has never been trained. Spelled here rather
     than reusing `ExerciseList` — that component is the browse-and-search
     posture, and these two sections are neither. -->
{#snippet familyRow(entry: Exercise)}
	{@const last = data.lastPerformed[entry.id]}
	{@const since = lastSinceLabel(last, now)}

	{#snippet recency()}{since}{/snippet}

	<ListRow
		title={entry.name}
		meta={lastSetLabel(last)}
		trailing={since === undefined ? undefined : recency}
		href="/exercises/{entry.id}"
	/>
{/snippet}

<main class="column-content flex min-h-full flex-col gap-5 px-3 pt-safe-t pb-4 lg:pt-0">
	<header class="flex flex-col gap-2 pt-3">
		<div class="flex items-center gap-3">
			<!-- `‹` is a character, like ListRow's `›` — measured: U+2039 present in
			     the subset. -->
			<a
				href="/exercises"
				aria-label="Back to exercises"
				class="grid min-h-chrome w-11 shrink-0 place-items-center rounded-full border
					border-line text-xl leading-none text-ink-muted focus-ring hover:bg-surface-2
					active:bg-surface-2"
			>
				‹
			</a>

			<h1 class="min-w-0 text-2xl font-extrabold tracking-tight">{exercise.name}</h1>
		</div>

		<!-- The art beside what describes the exercise, vertically centred against
		     it, so neither column floats in space the other left empty. Absent,
		     not reserved, when there is no art: the notes column simply takes the
		     full width. -->
		<div class="flex items-center justify-between gap-4 px-1">
			<div class="flex min-w-0 flex-col gap-2">
				<!-- No equipment: the name already carries it wherever it is not the
				     default. What survives is the load mode, and only when there is one
				     — it is the line that says the numbers below count double. -->
				{#if loadNote}
					<p class="text-md font-bold text-ink-faint">{loadNote}</p>
				{/if}

				<div class="flex flex-wrap gap-1.5">
					<Badge tone="accent">{exercise.muscles.primary}</Badge>
					{#each exercise.muscles.secondary as muscle (muscle)}
						<Badge>{muscle}</Badge>
					{/each}
				</div>
			</div>

			<ExerciseIllustration id={exercise.id} name={exercise.name} class="size-36 shrink-0" />
		</div>
	</header>

	{#if pr !== null}
		<section
			class="flex items-baseline justify-between gap-3 rounded-2xl border border-line-soft
				bg-surface px-4 py-3"
		>
			<span class="label-caps text-ink-faint">Raw best</span>
			<span class="text-xl font-extrabold tracking-tight">
				{pr.set.weight} × {pr.set.reps}
			</span>
		</section>
	{/if}

	{#if family.parent !== null}
		<section class="flex flex-col gap-2">
			<h2 class="px-3 label-caps">Variant of</h2>
			<div class="list-group">{@render familyRow(family.parent)}</div>
		</section>
	{/if}

	{#if family.variants.length > 0}
		<section class="flex flex-col gap-2">
			<h2 class="px-3 label-caps">Variants</h2>
			<div class="list-group">
				{#each family.variants as variant (variant.id)}
					{@render familyRow(variant)}
				{/each}
			</div>
		</section>
	{/if}

	<section class="flex flex-col gap-2">
		<h2 class="px-3 label-caps">History</h2>

		{#if sessions.length === 0}
			<EmptyState
				title="No history yet"
				description="Hints stay silent until this exercise is logged."
			>
				{#snippet icon()}
					<Calendar size={24} />
				{/snippet}
			</EmptyState>
		{:else}
			<!-- The same card the family lists above wear. Each entry is one link
			     into the workout it came from — the ordinal says where in that
			     session the exercise sat, and the answer to "what else did I do
			     that day" is one tap, not a hunt through the History tab. -->
			<div class="list-group">
				{#each sessions as session (session.workoutId)}
					<a
						href="/history/{session.workoutId}"
						data-list-row
						class="flex flex-col gap-2 px-3 py-2.5 focus-ring hover:bg-surface-2
							active:bg-surface-2 pointer-fine:transition-[background-color]
							pointer-fine:duration-100"
					>
						<div class="flex items-center gap-2">
							<span class="text-sm font-bold text-ink-faint">
								{day.format(session.date)} · {ordinal(session.position)} exercise
							</span>
							{#if session.date === pr?.date}
								<Badge tone="accent">PR</Badge>
							{/if}
							<span aria-hidden="true" class="ml-auto text-xl leading-none text-ink-faint">
								›
							</span>
						</div>

						<!-- One pill per set, in session order: the weight is the loud
						     number, the reps ride it muted — the two stopped sharing a
						     typeface the day the joined `·` line became unreadable. -->
						<div class="flex flex-wrap gap-1.5">
							{#each session.sets as set, index (index)}
								<span class="inline-flex items-baseline gap-1 rounded-lg bg-sunken px-2.5 py-1.5">
									<span class="text-md font-extrabold tracking-tight">{set.weight}</span>
									<span class="text-sm font-bold text-ink-faint">×{set.reps}</span>
								</span>
							{/each}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</section>
</main>
