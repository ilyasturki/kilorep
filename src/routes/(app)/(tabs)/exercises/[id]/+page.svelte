<script lang="ts">
	import { catalog } from '$lib/catalog';
	import type { Exercise } from '$lib/domain/exercise';
	import { rawPr } from '$lib/domain/stats';
	import { familyOf } from '$lib/exercises/browse';
	import { lastSetLabel, lastSinceLabel, loadModeNote } from '$lib/exercises/label';
	import Badge from '$lib/ui/Badge.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Calendar from '$lib/ui/icons/Calendar.svelte';

	import type { PageProps } from './$types';

	/**
	 * One exercise, read-only: what it is, the family around it, the raw best,
	 * the sessions behind it. Purely informational — catalog entries are
	 * immutable and customs are a later slice, so there is not a single action
	 * on this screen, and that is correct rather than unfinished.
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
	<header class="flex flex-col gap-3 pt-3">
		<!-- `‹` is a character, like ListRow's `›` — measured: U+2039 present in
		     the subset. -->
		<a
			href="/exercises"
			aria-label="Back to exercises"
			class="grid min-h-chrome w-11 place-items-center self-start rounded-full border
				border-line text-xl leading-none text-ink-muted focus-ring hover:bg-surface-2
				active:bg-surface-2"
		>
			‹
		</a>

		<div class="flex flex-col gap-1 px-1">
			<h1 class="text-2xl font-extrabold tracking-tight">{exercise.name}</h1>
			<!-- No equipment: the name already carries it wherever it is not the
			     default. What survives is the load mode, and only when there is one
			     — it is the line that says the numbers below count double. -->
			{#if loadNote}
				<p class="text-md font-bold text-ink-faint">{loadNote}</p>
			{/if}

			<div class="flex flex-wrap gap-1.5 pt-1">
				<Badge tone="accent">{exercise.muscles.primary}</Badge>
				{#each exercise.muscles.secondary as muscle (muscle)}
					<Badge>{muscle}</Badge>
				{/each}
			</div>
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
		<section class="flex flex-col gap-1">
			<h2 class="px-3 label-caps text-ink-faint">Variant of</h2>
			{@render familyRow(family.parent)}
		</section>
	{/if}

	{#if family.variants.length > 0}
		<section class="flex flex-col gap-1">
			<h2 class="px-3 label-caps text-ink-faint">Variants</h2>
			{#each family.variants as variant (variant.id)}
				{@render familyRow(variant)}
			{/each}
		</section>
	{/if}

	<section class="flex flex-col gap-1">
		<h2 class="px-3 label-caps text-ink-faint">History</h2>

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
			<div class="flex flex-col px-3">
				{#each sessions as session (session.date)}
					<div class="flex flex-col gap-0.5 border-b border-line-soft py-2.5 last:border-0">
						<div class="flex items-center gap-2">
							<span class="text-sm font-bold text-ink-faint">{day.format(session.date)}</span>
							{#if session.date === pr?.date}
								<Badge tone="accent">PR</Badge>
							{/if}
						</div>
						<p class="text-md font-extrabold tracking-tight">
							{session.sets.map((set) => `${set.weight} × ${set.reps}`).join('  ·  ')}
						</p>
					</div>
				{/each}
			</div>
		{/if}
	</section>
</main>
