<script lang="ts" module>
	import type { Component } from 'svelte';

	import { catalog } from '$lib/catalog';
	import type { Muscle } from '$lib/domain/exercise';
	import { sections } from '$lib/exercises/browse';
	import Back from '$lib/ui/icons/muscles/Back.svelte';
	import Biceps from '$lib/ui/icons/muscles/Biceps.svelte';
	import Calves from '$lib/ui/icons/muscles/Calves.svelte';
	import Chest from '$lib/ui/icons/muscles/Chest.svelte';
	import Core from '$lib/ui/icons/muscles/Core.svelte';
	import Forearms from '$lib/ui/icons/muscles/Forearms.svelte';
	import Glutes from '$lib/ui/icons/muscles/Glutes.svelte';
	import Hamstrings from '$lib/ui/icons/muscles/Hamstrings.svelte';
	import Quads from '$lib/ui/icons/muscles/Quads.svelte';
	import Shoulders from '$lib/ui/icons/muscles/Shoulders.svelte';
	import Triceps from '$lib/ui/icons/muscles/Triceps.svelte';

	// Once per app, not per mount: the catalog is immutable and the insert
	// sheet re-mounts this list on every open.
	const browse = sections(catalog);

	/**
	 * The one place a `Muscle` becomes a picture. This is the lookup the icons
	 * README rules out — and the reason it does not apply here: the objection to
	 * a dispatcher is that it defeats tree-shaking and pays a runtime branch per
	 * icon, and this screen renders all eleven at once, one lookup per section.
	 * Nothing is shaken out because nothing is unused.
	 *
	 * `Record<Muscle, …>` and not a partial map: a muscle added to `MUSCLES`
	 * without a body map drawn for it fails the build here rather than rendering
	 * a section with a hole above it.
	 */
	const MUSCLE_ICONS: Record<Muscle, Component<{ size?: number; class?: string }>> = {
		Chest,
		Back,
		Shoulders,
		Biceps,
		Triceps,
		Forearms,
		Core,
		Quads,
		Hamstrings,
		Glutes,
		Calves
	};
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
	 *
	 * Every block of rows here — a muscle's exercises, a search's results, the
	 * Similar shortcut — is one `list-group` card. Bare rows on the page were
	 * legible on a phone and a wash of text on a monitor, where the column is
	 * wide and nothing draws an edge between one exercise and the next.
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
	     there is nothing to answer for.

	     A variant is indented with padding rather than a margin, now that the row
	     sits inside a card: a margin would pull the row off the card's left edge
	     and take the hairline above it along, leaving a divider that starts a
	     third of the way in. -->
	<ListRow
		title={exercise.name}
		match={searching ? matchRange(exercise.name, query) : null}
		meta={lastSetLabel(last)}
		trailing={since === undefined ? undefined : recency}
		chevron={onpick === undefined}
		href={onpick === undefined ? `/exercises/${exercise.id}` : undefined}
		onclick={onpick === undefined ? undefined : () => onpick(exercise)}
		class={indented ? 'pl-11' : undefined}
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
		<!-- One card, not one per result: the ranking is the answer and a stack of
		     separate cards would draw eleven edges through a single ordered list. -->
		<div class="list-group">
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
			<section class="flex flex-col gap-2">
				<h2 class="px-3 label-caps">Similar</h2>

				<div class="list-group">
					{#each similar as exercise (exercise.id)}
						{@render row(exercise, false)}
					{/each}
				</div>
			</section>
		{/if}

		{#each browse as section (section.muscle)}
			<!-- Capitalised because that is what makes it a component in the
			     template; `Muscle` itself is taken by the domain type. -->
			{@const Figure = MUSCLE_ICONS[section.muscle]}

			<section class="flex flex-col gap-2">
				<!-- The figure is the anchor on a long scroll and the word confirms
				     it, so both sit above the card rather than inside it: a header
				     row would spend a whole tappable-height slot on something that
				     is not tappable. 28px is the floor the family is legible at —
				     `icons/README.md` has the measurement and what breaks below it. -->
				<h2 class="flex items-center gap-2 px-3 label-caps">
					<Figure size={28} />
					{section.muscle}
				</h2>

				<div class="list-group">
					{#each section.families as family (family.parent.id)}
						{@render row(family.parent, false)}

						{#if family.variants.length > 0}
							{@const open = expanded[family.parent.id] === true}

							<!-- Its own row rather than a control inside the parent's:
							     ListRow's rule is one element per tap, and the parent row
							     already spends its tap on the exercise itself. Square, like
							     every row in the card — the card owns the corners. -->
							<button
								type="button"
								onclick={() => (expanded[family.parent.id] = !open)}
								class="flex min-h-chrome w-full items-center gap-1.5 pr-3 pl-11 text-left
									label-caps focus-ring-inset hover:bg-surface-2 active:bg-surface-2"
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
				</div>
			</section>
		{/each}
	</div>
{/if}
