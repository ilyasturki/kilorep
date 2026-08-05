<script lang="ts" module>
	import { catalog } from '$lib/catalog';
	import { sections } from '$lib/exercises/browse';

	const chip =
		'relative inline-flex min-h-chip items-center rounded-xl bg-sunken px-3 text-sm font-bold ' +
		'text-ink-muted select-none focus-ring hover:bg-hover press:bg-surface-2 press-sink ' +
		'pointer-fine:transition-[background-color] pointer-fine:duration-100';

	// What the merged row is actually pressed on: a link the size of the whole
	// cell, lying under the title line and behind the chips. The title line is
	// inert and lets clicks through to it, the chips sit above it and keep
	// their own; the hover that reads as "one row" belongs to the cell they
	// share, not to either.
	const backdrop = 'absolute inset-0 focus-ring';

	// No sink on the cell: it is a fill behind the chips rather than a shape of
	// its own, and one that shrinks pulls away from the row it is filling.
	const cell =
		'relative flex flex-col hover:bg-hover press:bg-surface-2 ' +
		'pointer-fine:transition-[background-color] pointer-fine:duration-100';
</script>

<script lang="ts">
	import { matchRange, searchExercises } from '$lib/domain/search';
	import type { Exercise, Muscle } from '$lib/domain/exercise';
	import type { Family } from '$lib/exercises/browse';
	import ExerciseIllustration from '$lib/exercises/ExerciseIllustration.svelte';
	import { lastSetLabel, lastSinceLabel, variantLabel } from '$lib/exercises/label';
	import type { LastPerformed } from '$lib/store/derive';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Check from '$lib/ui/icons/Check.svelte';
	import MagnifyingGlass from '$lib/ui/icons/MagnifyingGlass.svelte';
	import { press } from '$lib/ui/press';

	type Props = {
		query: string;
		muscle?: Muscle | null;
		lastPerformed: LastPerformed;
		onpick?: (exercise: Exercise) => void;
		shelf?: { title: string; exercises: Exercise[] } | null;
		selected?: ReadonlySet<string>;
	};

	let { query, muscle = null, lastPerformed, onpick, shelf = null, selected }: Props = $props();

	/**
	 * Read once per mount, not per render: nothing on screen is worth a ticking
	 * clock, `12d` is wrong for at most a day, and the sheet re-mounts this list
	 * on every open — so the reading is fresh exactly when a row is being read.
	 */
	const now = Date.now();

	const browse = sections(catalog);

	const searching = $derived(query.trim() !== '');

	const results = $derived(
		searchExercises(catalog, query).filter(
			(exercise) => muscle === null || exercise.muscles.primary === muscle
		)
	);

	const shelves = $derived(
		muscle === null ? browse : browse.filter((section) => section.muscle === muscle)
	);
</script>

{#snippet row(exercise: Exercise, merged = false)}
	{@const last = lastPerformed[exercise.id]}
	{@const since = lastSinceLabel(last, now)}
	{@const picked = selected !== undefined && selected.has(exercise.id)}

	{#snippet recency()}
		{since}

		{#if selected !== undefined}
			<span
				aria-hidden="true"
				class={[
					'grid size-6 place-items-center rounded-full',
					picked ? 'bg-accent text-on-accent' : 'border-[1.5px] border-line text-transparent'
				]}
			>
				<Check size={14} />
			</span>
		{/if}
	{/snippet}

	{#snippet thumb()}
		<span class="size-11 shrink-0">
			<ExerciseIllustration id={exercise.id} name={exercise.name} class="size-full" />
		</span>
	{/snippet}

	<!-- Merged, the row is a passenger: the press belongs to the backdrop
	     spanning the whole cell, so this line renders inert and lets the click
	     through rather than competing for it. The chevron is asked for outright,
	     since inert is exactly the case where it would otherwise go missing. -->
	<ListRow
		title={exercise.name}
		match={searching ? matchRange(exercise.name, query) : null}
		meta={lastSetLabel(last)}
		leading={thumb}
		trailing={since === undefined && selected === undefined ? undefined : recency}
		chevron={onpick === undefined}
		pressed={selected === undefined || merged ? undefined : picked}
		href={merged || onpick !== undefined ? undefined : `/exercises/${exercise.id}`}
		onclick={merged || onpick === undefined ? undefined : () => onpick(exercise)}
		class={merged ? 'pointer-events-none' : undefined}
	/>
{/snippet}

<!-- One row, two lines: the family's head and the members standing behind it,
     inside a single cell with a single hover and a single tap. They were two
     rows and read as two exercises — which the fold exists to deny. -->
{#snippet familyRow(family: Family)}
	{@const parent = family.parent}

	<div class={cell}>
		{#if onpick === undefined}
			<a
				href="/exercises/{parent.id}"
				aria-label={parent.name}
				data-list-row
				class={backdrop}
				{@attach press()}
			></a>
		{:else}
			<button
				type="button"
				aria-label={parent.name}
				aria-pressed={selected === undefined ? undefined : selected.has(parent.id)}
				onclick={() => onpick?.(parent)}
				data-list-row
				class={backdrop}
				{@attach press()}
			></button>
		{/if}

		{@render row(parent, true)}

		{#if family.variants.length > 0}
			<div class="relative -mt-1 flex flex-wrap gap-1.5 pr-3 pb-2.5 pl-17">
				{#each family.variants as variant (variant.id)}
					{@const label = variantLabel(variant.name, parent.name)}

					{#if onpick === undefined}
						<a
							href="/exercises/{variant.id}"
							aria-label={variant.name}
							class={chip}
							{@attach press()}
						>
							{label}
						</a>
					{:else}
						<button
							type="button"
							onclick={() => onpick?.(variant)}
							aria-label={variant.name}
							aria-pressed={selected === undefined ? undefined : selected.has(variant.id)}
							class={[chip, 'aria-pressed:bg-accent aria-pressed:text-on-accent']}
							{@attach press()}
						>
							{label}
						</button>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

{#if searching}
	{#if results.length === 0}
		<EmptyState
			title="Nothing found"
			description={muscle === null
				? 'No exercise answers to that.'
				: `No ${muscle} exercise answers to that.`}
		>
			{#snippet icon()}
				<MagnifyingGlass size={24} />
			{/snippet}
		</EmptyState>
	{:else}
		<div class="list-group">
			{#each results as exercise (exercise.id)}
				{@render row(exercise)}
			{/each}
		</div>
	{/if}
{:else}
	<div class="flex flex-col gap-5">
		{#if shelf !== null && shelf.exercises.length > 0 && muscle === null}
			<section class="flex flex-col gap-2">
				<h2 class="px-3 label-caps">{shelf.title}</h2>

				<div class="list-group">
					{#each shelf.exercises as exercise (exercise.id)}
						{@render row(exercise)}
					{/each}
				</div>
			</section>
		{/if}

		{#each shelves as section (section.muscle)}
			<section class="flex flex-col gap-2">
				<h2 class="px-3 label-caps">{section.muscle}</h2>

				<div class="list-group">
					{#each section.families as family (family.parent.id)}
						{#if family.variants.length > 0}
							{@render familyRow(family)}
						{:else}
							{@render row(family.parent)}
						{/if}
					{/each}
				</div>
			</section>
		{/each}
	</div>
{/if}
