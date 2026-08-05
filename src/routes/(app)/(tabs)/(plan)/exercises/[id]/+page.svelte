<script lang="ts">
	import { catalog } from '$lib/catalog';
	import { fillAppBar } from '$lib/nav/bar.svelte';
	import type { Exercise } from '$lib/domain/exercise';
	import { rawPr } from '$lib/domain/stats';
	import { kin } from '$lib/exercises/browse';
	import ExerciseIllustration from '$lib/exercises/ExerciseIllustration.svelte';
	import { lastSetLabel, lastSinceLabel, loadModeNote, ordinal } from '$lib/exercises/label';
	import Badge from '$lib/ui/Badge.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import { press } from '$lib/ui/press';
	import Calendar from '$lib/ui/icons/Calendar.svelte';

	import type { PageProps } from './$types';

	/**
	 * One exercise: what it is, the family around it, the raw best, the
	 * sessions behind it. Catalog entries are immutable and customs are a later
	 * slice, so every action here is a navigation — the family links, and each
	 * history entry through to the workout it came from. This screen writes
	 * nothing.
	 *
	 * The est-1RM trend is settled but still absent: charting is decided now
	 * — the Dashboard's sparklines, drawn from the same `estTrend` — and the
	 * trend lands here as its own change, not smuggled into another one.
	 *
	 * History is the store's, derived from finished workouts on the way in.
	 */
	let { data }: PageProps = $props();

	const exercise = $derived(data.exercise);

	fillAppBar(() => ({ title: exercise.name }));

	// One list and no direction: whoever is on screen, the rest of the family is
	// what they might have meant instead, and the parent has no claim to be read
	// differently from a sibling. Hints never cross these rows — the links exist
	// exactly because each one is its own history.
	const family = $derived(kin(catalog, exercise));

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
     the line-art thumb, last time's best set beside the name, how long since on
     the right, and nothing at all when the entry has never been trained.
     Spelled here rather than reusing `ExerciseList` — that component is the
     browse-and-search posture, and this section is neither. -->
{#snippet familyRow(entry: Exercise)}
	{@const last = data.lastPerformed[entry.id]}
	{@const since = lastSinceLabel(last, now)}

	{#snippet recency()}{since}{/snippet}

	<!-- The slot is reserved even when the entry has no art, exactly like the
	     catalog rows: a missing thumb must not unalign the one title in the
	     column that lacks it. -->
	{#snippet thumb()}
		<span class="size-11 shrink-0">
			<ExerciseIllustration id={entry.id} name={entry.name} class="size-full" />
		</span>
	{/snippet}

	<ListRow
		title={entry.name}
		meta={lastSetLabel(last)}
		leading={thumb}
		trailing={since === undefined ? undefined : recency}
		href="/exercises/{entry.id}"
	/>
{/snippet}

<main class="column-content flex min-h-full flex-col gap-5 px-3 pt-3 pb-4">
	<header class="flex flex-col gap-2">
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

				<!-- The best set ever logged, opposite the art rather than in a slab of
				     its own below the fold of the header. It belongs with what describes
				     the exercise: the load mode says how the numbers are counted and the
				     badges say what the lift is, and this is the third fact of the same
				     paragraph.

				     It keeps its border and fill at a smaller scale, sized to its
				     contents — the one measured thing in a column of labels, and a
				     bordered card is how this app has always said so. Wrapping rather
				     than truncating: the column is ~183px beside a 144px illustration on
				     a 375px phone, which `RAW BEST 100 × 5` fits on one line and a
				     four-digit total would not.

				     `label-caps` carries `ink-faint` itself, so the colour is not
				     restated here. -->
				{#if pr !== null}
					<div
						class="flex w-fit flex-wrap items-baseline gap-x-2 rounded-xl border
							border-line-soft bg-surface px-3 py-2"
					>
						<span class="label-caps">Raw best</span>
						<span class="text-md font-extrabold tracking-tight">
							{pr.set.weight} × {pr.set.reps}
						</span>
					</div>
				{/if}
			</div>

			<ExerciseIllustration id={exercise.id} name={exercise.name} class="size-36 shrink-0" />
		</div>
	</header>

	{#if family.length > 0}
		<section class="flex flex-col gap-2">
			<h2 class="px-3 label-caps">Variants</h2>
			<div class="list-group">
				{#each family as variant (variant.id)}
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
						class="flex press-sink flex-col gap-2 px-3 py-2.5 focus-ring
							hover:bg-hover pointer-fine:transition-[background-color]
							pointer-fine:duration-100 press:bg-surface-2"
						{@attach press()}
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
