<script lang="ts">
	import { invalidate } from '$app/navigation';

	import { catalog } from '$lib/catalog';
	import type { Exercise } from '$lib/domain/exercise';
	import { rawPr } from '$lib/domain/stats';
	import { applyMains, familyOf } from '$lib/exercises/browse';
	import ExerciseIllustration from '$lib/exercises/ExerciseIllustration.svelte';
	import { lastSetLabel, lastSinceLabel, loadModeNote, ordinal } from '$lib/exercises/label';
	import BackLink from '$lib/nav/BackLink.svelte';
	import { syncSoon } from '$lib/sync/client';
	import Badge from '$lib/ui/Badge.svelte';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Calendar from '$lib/ui/icons/Calendar.svelte';
	import Star from '$lib/ui/icons/Star.svelte';

	import type { PageProps } from './$types';

	/**
	 * One exercise: what it is, the family around it, the raw best, the
	 * sessions behind it. Catalog entries are immutable and customs are a later
	 * slice, so nearly every action here is a navigation — the family links,
	 * and each history entry through to the workout it came from. The one
	 * write is `Set as main`: which member heads this family is the account's
	 * taste, not the catalog's fact, and this screen is where the family is
	 * laid out to choose from.
	 *
	 * The est-1RM trend is settled but still absent: charting is decided now
	 * — the Dashboard's sparklines, drawn from the same `estTrend` — and the
	 * trend lands here as its own change, not smuggled into another one.
	 *
	 * History is the store's, derived from finished workouts on the way in.
	 */
	let { data }: PageProps = $props();

	const exercise = $derived(data.exercise);

	// Hints never cross the family's rows — the links exist exactly because
	// each one is its own history. The fold runs over the reseated pool, so
	// "Variant of" names the account's chosen main and "Variants" is everyone
	// standing behind it — the catalog's own parent included, once demoted.
	const pool = $derived(applyMains(catalog, data.mains));
	const seated = $derived(pool.find((entry) => entry.id === exercise.id) ?? exercise);
	const family = $derived(familyOf(pool, seated));

	// The family's permanent name — the catalog's canonical parent — which is
	// what preference records key on, whoever currently heads the fold.
	const familyId = $derived(exercise.variantOf ?? exercise.id);

	/**
	 * Seats `id` at the head of this family, everywhere at once: the browse
	 * row, the picker's family tap, and both sections below re-fold around it
	 * on the invalidate. Choosing the canonical parent back writes
	 * `main === family`, which every reader treats as no preference at all.
	 */
	async function promote(id: string) {
		await data.store.setMainVariant({ family: familyId, main: id }, Date.now());

		if (data.user) {
			syncSoon(data.user.id);
		}

		await invalidate('app:mains');
	}

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
     the line-art thumb, last time's best set under the name, how long since on
     the right, and nothing at all when the entry has never been trained.
     Spelled here rather than reusing `ExerciseList` — that component is the
     browse-and-search posture, and these two sections are neither.

     `star` rides beside a row that can be seated at the family's head — every
     row under Variants, never the main under "Variant of". It sits outside
     the anchor, its own column at the row's edge, because ListRow's rule
     stands: a control inside a clickable row is two elements competing for
     one tap. The chevron yields its place — on these rows the star is what
     lives at the edge, and both marks at once would crowd it. -->
{#snippet familyRow(entry: Exercise, star: boolean)}
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

	{#if star}
		<div class="flex items-center">
			<ListRow
				title={entry.name}
				meta={lastSetLabel(last)}
				leading={thumb}
				trailing={since === undefined ? undefined : recency}
				chevron={false}
				href="/exercises/{entry.id}"
				class="min-w-0 flex-1"
			/>

			<button
				type="button"
				aria-label="Make {entry.name} the main variant"
				onclick={() => promote(entry.id)}
				class="mr-1 grid size-11 shrink-0 place-items-center rounded-xl text-ink-muted
					focus-ring hover:bg-hover active:bg-surface-2
					pointer-fine:transition-[background-color] pointer-fine:duration-100"
			>
				<Star size={20} />
			</button>
		</div>
	{:else}
		<ListRow
			title={entry.name}
			meta={lastSetLabel(last)}
			leading={thumb}
			trailing={since === undefined ? undefined : recency}
			href="/exercises/{entry.id}"
		/>
	{/if}
{/snippet}

<main class="column-content flex min-h-full flex-col gap-5 px-3 pt-safe-t pb-4 lg:pt-0">
	<header class="flex flex-col gap-2 pt-3">
		<div class="flex items-center gap-3">
			<!-- The variant chips below walk exercise to exercise, so the fixed
			     parent was wrong on this screen before any other: `/exercises` is
			     the catalog root, not the exercise the user pressed a chip from.
			     A plan card's title is now a third way in, and `BackLink` answers
			     all of them the same way: it walks history and keeps the root as
			     its fallback. -->
			<BackLink href="/exercises" label="Back to exercises" />

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

	{#if family.parent !== null}
		<section class="flex flex-col gap-2">
			<h2 class="px-3 label-caps">Variant of</h2>
			<div class="list-group">{@render familyRow(family.parent, false)}</div>

			<!-- Under the section that says this entry stands behind another:
			     the claim and the lever to reverse it, side by side. Promoting
			     re-folds the family everywhere the fold is read — this screen,
			     the browse row, the picker's family tap. -->
			<Button onclick={() => promote(seated.id)} class="w-fit">
				<Star size={18} />
				Set as main variant
			</Button>
		</section>
	{/if}

	{#if family.variants.length > 0}
		<section class="flex flex-col gap-2">
			<h2 class="px-3 label-caps">Variants</h2>
			<div class="list-group">
				{#each family.variants as variant (variant.id)}
					{@render familyRow(variant, true)}
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
						class="flex flex-col gap-2 px-3 py-2.5 focus-ring hover:bg-hover
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
