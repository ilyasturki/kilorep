<script lang="ts" module>
	// The one grid every ledger line shares: illustration, name, equipment, last session,
	// heaviest ever, recency, chevron.
	const columns = 'grid grid-cols-[56px_minmax(0,1fr)_130px_170px_150px_90px_44px] items-center';

	export type LedgerSort = 'muscle' | 'name' | 'recent';
</script>

<script lang="ts">
	import { catalog } from '$lib/catalog';
	import { matchRange, searchExercises } from '$lib/domain/search';
	import type { Equipment, Exercise } from '$lib/domain/exercise';
	import { countOf, sections } from '$lib/exercises/browse';
	import ExerciseIllustration from '$lib/exercises/ExerciseIllustration.svelte';
	import { lastSetLabel, lastSinceLabel, setLabel } from '$lib/exercises/label';
	import type { Heaviest, LastPerformed } from '$lib/store/derive';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import MagnifyingGlass from '$lib/ui/icons/MagnifyingGlass.svelte';
	import { press } from '$lib/ui/press';

	type Props = {
		query: string;
		equipment: Equipment | '';
		sort: LedgerSort;
		lastPerformed: LastPerformed;
		heaviest: Heaviest;
	};

	let { query, equipment, sort, lastPerformed, heaviest }: Props = $props();

	const now = Date.now();

	const pool = $derived(
		equipment === '' ? catalog : catalog.filter((exercise) => exercise.equipment === equipment)
	);

	const searching = $derived(query.trim() !== '');

	const flat = $derived.by((): Exercise[] | null => {
		if (searching) {
			return searchExercises(pool, query);
		}

		if (sort === 'name') {
			return pool.toSorted((a, b) => a.name.localeCompare(b.name));
		}

		if (sort === 'recent') {
			return pool.toSorted((a, b) => {
				const at = lastPerformed[a.id]?.date;
				const bt = lastPerformed[b.id]?.date;

				if (at === undefined && bt === undefined) {
					return a.name.localeCompare(b.name);
				}

				return (bt ?? 0) - (at ?? 0);
			});
		}

		return null;
	});

	const banded = $derived(flat === null ? sections(pool) : []);
</script>

{#snippet row(exercise: Exercise, variant = false)}
	{@const session = lastPerformed[exercise.id]}
	{@const last = lastSetLabel(exercise, session)}
	{@const best = heaviest[exercise.id]}
	{@const since = lastSinceLabel(session, now)}
	{@const match = searching ? matchRange(exercise.name, query) : null}

	<a
		href="/plan/exercises/{exercise.id}"
		data-ripple
		class="{columns} min-h-row border-t border-line-soft focus-ring-inset first:border-t-0
			hover:bg-hover pointer-fine:transition-[background-color]
			pointer-fine:duration-100 press:bg-surface-2"
		{@attach press()}
	>
		<span class="flex justify-center">
			{#if !variant}
				<ExerciseIllustration id={exercise.id} name={exercise.name} class="size-[34px]" />
			{/if}
		</span>

		<span class="flex min-w-0 items-center gap-2 pr-3">
			{#if variant}
				<span
					aria-hidden="true"
					class="mb-2.5 ml-1 size-3 shrink-0 rounded-bl-md border-b-2 border-l-2 border-line-soft"
				></span>
			{/if}

			<span
				class={[
					'truncate tracking-tight',
					variant ? 'text-base font-bold text-ink' : 'text-base font-extrabold text-ink'
				]}
			>
				{#if match !== null}
					{exercise.name.slice(0, match.start)}<mark
						class="bg-transparent text-inherit underline decoration-2 underline-offset-2"
						>{exercise.name.slice(match.start, match.end)}</mark
					>{exercise.name.slice(match.end)}
				{:else}
					{exercise.name}
				{/if}
			</span>

			{#if exercise.grips !== undefined}
				<span class="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 label-caps text-ink-muted">
					{exercise.grips.values.length} grips
				</span>
			{/if}
		</span>

		<span class="truncate pr-2 text-sm font-semibold text-ink-muted">{exercise.equipment}</span>

		{#if last === undefined}
			<span class="text-md font-bold text-ink-faint">—</span>
		{:else}
			<span class="text-md font-bold tracking-numeral text-ink">{last}</span>
		{/if}

		{#if best === undefined}
			<span class="text-md font-bold text-ink-faint">—</span>
		{:else}
			<span class="text-md font-bold tracking-numeral text-ink-muted">
				{setLabel(exercise, best)}
			</span>
		{/if}

		<span
			class={['text-md font-extrabold', since === undefined ? 'text-ink-faint' : 'text-ink-muted']}
		>
			{since ?? '—'}
		</span>

		<span aria-hidden="true" class="text-center text-xl leading-none text-ink-faint">›</span>
	</a>
{/snippet}

<div class="flex flex-col gap-1.5">
	<div class="{columns} sticky top-0 z-10 -mt-1.5 bg-canvas px-1 pt-1.5 pb-2">
		<span></span>
		<span class="label-caps">Exercise</span>
		<span class="label-caps">Equipment</span>
		<span class="label-caps">Last session</span>
		<span class="label-caps">Heaviest</span>
		<span class="label-caps">Trained</span>
		<span></span>
	</div>

	{#if searching && flat !== null && flat.length === 0}
		<EmptyState title="Nothing found" description="No exercise answers to that.">
			{#snippet icon()}
				<MagnifyingGlass size={24} />
			{/snippet}
		</EmptyState>
	{:else}
		<div class="flex flex-col overflow-hidden rounded-2xl border border-line-soft bg-surface">
			{#if flat !== null}
				{#each flat as exercise (exercise.id)}
					{@render row(exercise)}
				{/each}
			{:else}
				{#each banded as section (section.muscle)}
					<div
						class="flex min-h-row items-center gap-2.5 border-t border-line-soft bg-canvas px-4
							first:border-t-0"
					>
						<span class="text-md font-extrabold text-ink">{section.muscle}</span>
						<span class="text-xs font-extrabold text-ink-faint">
							{countOf(section.families)} exercises
						</span>
					</div>

					{#each section.families as family (family.parent.id)}
						{@render row(family.parent)}

						{#each family.variants as variant (variant.id)}
							{@render row(variant, true)}
						{/each}
					{/each}
				{/each}
			{/if}
		</div>
	{/if}
</div>
