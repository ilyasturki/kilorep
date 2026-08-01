<script lang="ts" module>
	import { catalog } from '$lib/catalog';
	import { sections } from '$lib/exercises/browse';

	// Once per app, not per mount: the catalog is immutable and the insert
	// sheet re-mounts this list on every open.
	const browse = sections(catalog);
</script>

<script lang="ts">
	import { matchRange, searchExercises } from '$lib/domain/search';
	import type { Exercise } from '$lib/domain/exercise';
	import { lastSetLabel, lastSinceLabel } from '$lib/exercises/label';
	import type { LastPerformed } from '$lib/store/derive';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import CaretDown from '$lib/ui/icons/CaretDown.svelte';
	import MagnifyingGlass from '$lib/ui/icons/MagnifyingGlass.svelte';

	/**
	 * The catalog, in both of its postures: browsing and searching. One
	 * component with two consumers — the Exercises screen, where a row
	 * navigates to the detail, and the mid-workout insert sheet, where a row is
	 * picked — because the folding rules below are exactly the kind of thing
	 * that drifts when written twice.
	 *
	 * Browsing shows sections by muscle, one row per family; the variants sit
	 * behind an expander so Lat Pulldown is one row, not three. Searching
	 * flattens everything into `searchExercises`' ranked order — ranking beats
	 * shelving once a question has been asked — and variants surface
	 * individually, which is how "close grip" goes straight to the child.
	 *
	 * A row says what it was last lifted at and how long ago, which is what the
	 * pick actually turns on; an exercise with no past says nothing at all, so
	 * the list sorts itself by eye into movements trained and movements not.
	 */
	type Props = {
		query: string;
		/**
		 * Every exercise's last session. Passed in rather than read here: this
		 * component stays store-free, and all three consumers already load from
		 * the store on the way in.
		 */
		lastPerformed: LastPerformed;
		/** Row action. Absent, rows navigate to the exercise detail instead. */
		onpick?: (exercise: Exercise) => void;
		/**
		 * A short list to shelve above the sections, for a caller that arrived
		 * with a question the muscle order cannot answer — today that is the swap
		 * picker and `similarTo`. Browse posture only: a search has already been
		 * asked and answered, and a pinned block above its results would be the
		 * screen ignoring what was typed.
		 */
		similar?: Exercise[];
	};

	let { query, lastPerformed, onpick, similar = [] }: Props = $props();

	/**
	 * Read once per mount, not per render: nothing on screen is worth a ticking
	 * clock, `12d` is wrong for at most a day, and the sheet re-mounts this list
	 * on every open — so the reading is fresh exactly when a row is being read.
	 */
	const now = Date.now();

	// The empty-query answer ("the pool, untouched") is `searchExercises`' own
	// rule; `searching` only picks which posture the template draws.
	const searching = $derived(query.trim() !== '');
	const results = $derived(searchExercises(catalog, query));

	// Collapsed between visits and between families: remembering which family
	// was open is not worth the state, and an expander is one tap.
	let expanded = $state<Record<string, boolean>>({});
</script>

{#snippet row(exercise: Exercise, indented: boolean)}
	{@const last = lastPerformed[exercise.id]}
	{@const since = lastSinceLabel(last, now)}

	<!-- Declared inside the row rather than beside it so the snippet closes over
	     this exercise, and so `trailing` can be withheld entirely on an untrained
	     row: an always-passed snippet rendering nothing would still open
	     ListRow's trailing span, and its gap would shift the chevron on every
	     row that has no past. -->
	{#snippet recency()}{since}{/snippet}

	<!-- The mark rides the search posture only — browsing asked no question, so
	     there is nothing to answer for. -->
	<ListRow
		title={exercise.name}
		match={searching ? matchRange(exercise.name, query) : null}
		meta={lastSetLabel(last)}
		trailing={since === undefined ? undefined : recency}
		chevron={onpick === undefined}
		href={onpick === undefined ? `/exercises/${exercise.id}` : undefined}
		onclick={onpick === undefined ? undefined : () => onpick(exercise)}
		class={indented ? 'ml-8' : undefined}
	/>
{/snippet}

{#if searching}
	{#if results.length === 0}
		<EmptyState title="Nothing found" description="No exercise answers to that.">
			{#snippet icon()}
				<MagnifyingGlass size={24} />
			{/snippet}
		</EmptyState>
	{:else}
		<div class="flex flex-col gap-1">
			{#each results as exercise (exercise.id)}
				{@render row(exercise, false)}
			{/each}
		</div>
	{/if}
{:else}
	<div class="flex flex-col gap-5">
		<!-- Flat, and the variants are not folded: the whole point of this block is
		     that every row in it is already an answer, and an expander over six
		     rows would be a fold hiding nothing. The sections below are unchanged
		     underneath — this is a shortcut past them, never a replacement. -->
		{#if similar.length > 0}
			<section class="flex flex-col gap-1">
				<h2 class="px-3 label-caps text-ink-faint">Similar</h2>

				{#each similar as exercise (exercise.id)}
					{@render row(exercise, false)}
				{/each}
			</section>
		{/if}

		{#each browse as section (section.muscle)}
			<section class="flex flex-col gap-1">
				<h2 class="px-3 label-caps text-ink-faint">{section.muscle}</h2>

				{#each section.families as family (family.parent.id)}
					{@render row(family.parent, false)}

					{#if family.variants.length > 0}
						{@const open = expanded[family.parent.id] === true}

						<!-- Its own row rather than a control inside the parent's:
						     ListRow's rule is one element per tap, and the parent row
						     already spends its tap on the exercise itself. -->
						<button
							type="button"
							onclick={() => (expanded[family.parent.id] = !open)}
							class="ml-8 flex min-h-chrome items-center gap-1.5 rounded-xl px-3 text-left
								label-caps text-ink-faint focus-ring hover:bg-surface-2 active:bg-surface-2"
						>
							<CaretDown size={14} class="transition-transform {open ? 'rotate-180' : ''}" />
							{family.variants.length}
							{family.variants.length === 1 ? 'variant' : 'variants'}
						</button>

						{#if open}
							{#each family.variants as variant (variant.id)}
								{@render row(variant, true)}
							{/each}
						{/if}
					{/if}
				{/each}
			</section>
		{/each}
	</div>
{/if}
