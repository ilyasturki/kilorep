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

	// The same posture as `Chip.svelte`'s resting state, minus the toggle
	// machinery: these chips navigate or pick, they never stay pressed.
	const chip =
		'inline-flex min-h-chip items-center rounded-xl bg-sunken px-3 text-sm font-bold ' +
		'text-ink-muted select-none focus-ring hover:bg-surface-2 active:bg-surface-2 ' +
		'pointer-fine:transition-[background-color] pointer-fine:duration-100';
</script>

<script lang="ts">
	import { matchRange, searchExercises } from '$lib/domain/search';
	import type { Exercise } from '$lib/domain/exercise';
	import type { Family } from '$lib/exercises/browse';
	import ExerciseIllustration from '$lib/exercises/ExerciseIllustration.svelte';
	import { lastSetLabel, lastSinceLabel, variantLabel } from '$lib/exercises/label';
	import type { LastPerformed } from '$lib/store/derive';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import MagnifyingGlass from '$lib/ui/icons/MagnifyingGlass.svelte';

	/**
	 * The catalog, in both of its postures: browsing and searching. One
	 * component with two consumers — the Exercises screen, where a row
	 * navigates to the detail, and the mid-workout insert sheet, where a row is
	 * picked — because the folding rules below are exactly the kind of thing
	 * that drifts when written twice.
	 *
	 * Browsing shows sections by muscle, one row per family; the variants ride
	 * under the parent's row as named chips — "Close-Grip", "Incline" — one tap
	 * each, nothing folded away. Searching flattens everything into
	 * `searchExercises`' ranked order — ranking beats shelving once a question
	 * has been asked — and variants surface individually as full rows, which is
	 * how "close grip" goes straight to the child.
	 *
	 * A row says what it was last lifted at and how long ago, which is what the
	 * pick actually turns on; an exercise with no past says nothing at all, so
	 * the list sorts itself by eye into movements trained and movements not.
	 * Every row also carries its line-art thumb, because a picture answers
	 * "which machine is that" faster than any name.
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
</script>

{#snippet row(exercise: Exercise)}
	{@const last = lastPerformed[exercise.id]}
	{@const since = lastSinceLabel(last, now)}

	<!-- Declared inside the row rather than beside it so the snippet closes over
	     this exercise, and so `trailing` can be withheld entirely on an untrained
	     row: an always-passed snippet rendering nothing would still open
	     ListRow's trailing span, and its gap would shift the chevron on every
	     row that has no past. -->
	{#snippet recency()}{since}{/snippet}

	<!-- The slot is reserved even when the entry has no art (sumo-deadlift
	     today, every custom later): a missing thumb must not unalign the one
	     title in the column that lacks it. -->
	{#snippet thumb()}
		<span class="size-11 shrink-0">
			<ExerciseIllustration id={exercise.id} name={exercise.name} class="size-full" />
		</span>
	{/snippet}

	<!-- The mark rides the search posture only — browsing asked no question, so
	     there is nothing to answer for. -->
	<ListRow
		title={exercise.name}
		match={searching ? matchRange(exercise.name, query) : null}
		meta={lastSetLabel(last)}
		leading={thumb}
		trailing={since === undefined ? undefined : recency}
		chevron={onpick === undefined}
		href={onpick === undefined ? `/exercises/${exercise.id}` : undefined}
		onclick={onpick === undefined ? undefined : () => onpick(exercise)}
	/>
{/snippet}

{#snippet variantChips(family: Family)}
	<!-- Left edge on the title's column, under the thumb's width: the chips
	     belong to the name above them, not to the card. `aria-label` restores
	     the full name the chip's stripped label elides. -->
	<div class="flex flex-wrap gap-1.5 pt-0.5 pr-3 pb-2.5 pl-17">
		{#each family.variants as variant (variant.id)}
			{@const label = variantLabel(variant.name, family.parent.name)}

			{#if onpick === undefined}
				<a href="/exercises/{variant.id}" aria-label={variant.name} class={chip}>{label}</a>
			{:else}
				<button
					type="button"
					onclick={() => onpick?.(variant)}
					aria-label={variant.name}
					class={chip}
				>
					{label}
				</button>
			{/if}
		{/each}
	</div>
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
				{@render row(exercise)}
			{/each}
		</div>
	{/if}
{:else}
	<div class="flex flex-col gap-5">
		<!-- Flat, no chips: the whole point of this block is that every row in it
		     is already an answer. The sections below are unchanged underneath —
		     this is a shortcut past them, never a replacement. -->
		{#if similar.length > 0}
			<section class="flex flex-col gap-2">
				<h2 class="px-3 label-caps">Similar</h2>

				<div class="list-group">
					{#each similar as exercise (exercise.id)}
						{@render row(exercise)}
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
						<!-- One wrapper per family, so the card's hairlines fall
						     between families and the chip strip stays visually the
						     parent row's own. -->
						<div>
							{@render row(family.parent)}

							{#if family.variants.length > 0}
								{@render variantChips(family)}
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>
{/if}
