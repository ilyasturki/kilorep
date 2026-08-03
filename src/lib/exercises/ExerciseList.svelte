<script lang="ts" module>
	import { catalog } from '$lib/catalog';
	import { sections } from '$lib/exercises/browse';

	// Once per app, not per mount: the catalog is immutable and the insert
	// sheet re-mounts this list on every open.
	const browse = sections(catalog);

	// The same posture as `Chip.svelte`'s resting state, minus the toggle
	// machinery: these chips navigate or pick, they never stay pressed.
	const chip =
		'inline-flex min-h-chip items-center rounded-xl bg-sunken px-3 text-sm font-bold ' +
		'text-ink-muted select-none focus-ring hover:bg-surface-2 active:bg-surface-2 ' +
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

	/**
	 * The catalog, in both of its postures: browsing and searching. One
	 * component with two consumers — the Exercises screen, where a row
	 * navigates to the detail, and the mid-workout insert sheet, where a row is
	 * picked — because the folding rules below are exactly the kind of thing
	 * that drifts when written twice.
	 *
	 * Either posture can be narrowed to one muscle — see `muscle`, which the
	 * picker sheets drive from a chip rail and the Exercises screen leaves alone,
	 * that screen being shelved by muscle already.
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
		 * One muscle to narrow to, or null for the whole catalog.
		 *
		 * Applied to whichever posture is on screen, and to the thing that posture
		 * shows. Browsing, it picks the section — so a family stays whole and a
		 * close-grip bench keeps standing under Bench Press, where the fold already
		 * puts it. Searching, the list is flat and a row is one exercise, so the
		 * test is that exercise's own primary and the same close-grip bench answers
		 * to Triceps. Two answers to "which muscle", because there are two things
		 * being asked about; a search that re-shelved its results by family would
		 * be answering a question nobody asked.
		 */
		muscle?: Muscle | null;
		/**
		 * Every exercise's last session. Passed in rather than read here: this
		 * component stays store-free, and all three consumers already load from
		 * the store on the way in.
		 */
		lastPerformed: LastPerformed;
		/** Row action. Absent, rows navigate to the exercise detail instead. */
		onpick?: (exercise: Exercise) => void;
		/**
		 * A short list to shelve above the sections under its own heading, for a
		 * caller that arrived with a question the muscle order cannot answer — the
		 * swap picker's substitutes, the insert picker's what-you-actually-train.
		 * Browse posture only: a search has already been asked and answered, and a
		 * pinned block above its results would be the screen ignoring what was
		 * typed.
		 *
		 * The heading travels with the list rather than being chosen here, because
		 * the two shelves are two different claims — "these are like it" and "these
		 * are yours" — and only the caller knows which it just made.
		 */
		shelf?: { title: string; exercises: Exercise[] } | null;
		/**
		 * The picks so far, when the caller is collecting several before it acts.
		 * Undefined for the single-answer callers, whose rows fire and close — see
		 * `ListRow`'s `pressed` for what the difference costs a screen reader.
		 */
		selected?: ReadonlySet<string>;
	};

	let { query, muscle = null, lastPerformed, onpick, shelf = null, selected }: Props = $props();

	/**
	 * Read once per mount, not per render: nothing on screen is worth a ticking
	 * clock, `12d` is wrong for at most a day, and the sheet re-mounts this list
	 * on every open — so the reading is fresh exactly when a row is being read.
	 */
	const now = Date.now();

	// The empty-query answer ("the pool, untouched") is `searchExercises`' own
	// rule; `searching` only picks which posture the template draws.
	const searching = $derived(query.trim() !== '');

	// Filtered after ranking rather than before it: `searchExercises` scores a
	// pool, and scoring a pool of nine produces the same order as scoring the
	// whole catalog and dropping the rest. Doing it this way keeps the one
	// ranking every consumer sees.
	const results = $derived(
		searchExercises(catalog, query).filter(
			(exercise) => muscle === null || exercise.muscles.primary === muscle
		)
	);

	// The sections are built once for the app; narrowing is picking one of them
	// out, never rebuilding them for a filter. Filtering the *pool* first and
	// re-folding would split families apart — a triceps-primary close-grip bench
	// would be promoted to a row of its own the moment Triceps was lit.
	const shelves = $derived(
		muscle === null ? browse : browse.filter((section) => section.muscle === muscle)
	);
</script>

{#snippet row(exercise: Exercise)}
	{@const last = lastPerformed[exercise.id]}
	{@const since = lastSinceLabel(last, now)}
	{@const picked = selected !== undefined && selected.has(exercise.id)}

	<!-- Declared inside the row rather than beside it so the snippet closes over
	     this exercise, and so `trailing` can be withheld entirely on an untrained
	     row: an always-passed snippet rendering nothing would still open
	     ListRow's trailing span, and its gap would shift the chevron on every
	     row that has no past.

	     The mark rides in the same span while a caller is collecting picks, on
	     the right where the chevron would be — the one place in a row a status
	     has ever lived. `aria-hidden`, because `ListRow`'s `pressed` has already
	     said it, and a disc announcing "selected" beside a button announcing
	     "pressed" is one fact read twice. -->
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
		trailing={since === undefined && selected === undefined ? undefined : recency}
		chevron={onpick === undefined}
		pressed={selected === undefined ? undefined : picked}
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
				<!-- The accent fill is `Chip`'s selected dress, and it hangs off the
				     `aria-pressed` the row states rather than a class of its own —
				     the attribute selector outranks the resting `text-ink-muted` in
				     `chip` above, which a bare `text-on-accent` beside it would not:
				     Tailwind resolves that by stylesheet order, as `Chip` says. -->
				<button
					type="button"
					onclick={() => onpick?.(variant)}
					aria-label={variant.name}
					aria-pressed={selected === undefined ? undefined : selected.has(variant.id)}
					class={[chip, 'aria-pressed:bg-accent aria-pressed:text-on-accent']}
				>
					{label}
				</button>
			{/if}
		{/each}
	</div>
{/snippet}

{#if searching}
	{#if results.length === 0}
		<!-- Named when a muscle is lit, because that is the likelier culprit: the
		     query may well match something the filter is holding back, and
		     "nothing answers to that" would read as the catalog lacking it. -->
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
		     this is a shortcut past them, never a replacement.

		     Withheld under a lit muscle for the reason it is withheld under a
		     query: a filter is a question asked, and the shelf answers a different
		     one. Left standing it would shelve chest substitutes above a section
		     the user had just narrowed to Back — and, once the insert picker took
		     the same slot, a shelf of leg movements over a lit Chest. -->
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
				<!-- Above the card rather than inside it: a header row would spend a
				     whole tappable-height slot on something that is not tappable. -->
				<h2 class="px-3 label-caps">{section.muscle}</h2>

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
