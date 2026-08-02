<script lang="ts">
	import { catalog } from '$lib/catalog';
	import { MUSCLES } from '$lib/domain/exercise';
	import type { Exercise, Muscle } from '$lib/domain/exercise';
	import ExerciseList from '$lib/exercises/ExerciseList.svelte';
	import { similarTo } from '$lib/exercises/browse';
	import type { LastPerformed } from '$lib/store/derive';
	import Chip from '$lib/ui/Chip.svelte';
	import ChipGroup from '$lib/ui/ChipGroup.svelte';
	import SearchField from '$lib/ui/SearchField.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';

	/**
	 * The catalog behind a search field and a muscle rail, one tap to pick.
	 *
	 * Two questions, one sheet: which exercise to add to the session, and which
	 * one to swap an entry for. They differ in the title, in what the screen
	 * does with the answer, and — since `replacing` — in what sits at the top of
	 * the list. Still one component: a second copy would be a second search
	 * field to keep in step with the first.
	 *
	 * The same `ExerciseList` the Exercises screen uses — browse folded by
	 * family, search flat and ranked — with the rows picking instead of
	 * navigating. Tapping a family row takes the canonical parent immediately;
	 * the variants sit behind the same expander as everywhere else. In-gym
	 * rule: the common case is one tap after typing three letters.
	 *
	 * The rail is what the Exercises screen does not need and this sheet does.
	 * There, the muscle sections *are* the page and scrolling to one is free;
	 * here they sit inside a panel that opens over a live session, where the
	 * scroll is the friction and a chip is the way past it. It is the second
	 * half of the same act as the search field, so it sits directly under it.
	 */
	type Props = {
		open?: boolean;
		title: string;
		/**
		 * The exercise this pick will replace, which turns the sheet's browse
		 * posture into an answer rather than a catalog: `similarTo` shelves a
		 * handful of substitutes above the muscle sections. Null for an insert —
		 * nothing is being replaced, so there is nothing to be similar to.
		 */
		replacing?: Exercise | null;
		/** Straight through to the list, which renders it under each name. */
		lastPerformed: LastPerformed;
		onpick: (exerciseId: string) => void;
	};

	let { open = $bindable(false), title, replacing = null, lastPerformed, onpick }: Props = $props();

	const similar = $derived(replacing === null ? [] : similarTo(catalog, replacing));

	let query = $state('');

	/**
	 * The muscle rail's pick, empty for none — `''` is what a single-select
	 * ToggleGroup holds when nothing is on, and the list wants a `Muscle` or
	 * null, so the two meet here rather than in a component that would have to
	 * know about both.
	 *
	 * Search answers the "which exercise" question and this answers "which
	 * kind", and the two compose: three letters and a lit chip is the shortest
	 * route through a catalog that will keep growing. Nothing is lit on open —
	 * the sheet is asked to show everything, and a filter the user did not set
	 * is one they have to notice before they can undo it.
	 */
	let muscle = $state('');

	const narrowed = $derived(muscle === '' ? null : (muscle as Muscle));

	// Picking is the whole reason the sheet was opened, so it closes behind the
	// tap — and both questions reset with it, because the next one is new. A
	// muscle left lit would silently narrow an insert made twenty minutes later.
	function choose(exercise: Exercise) {
		onpick(exercise.id);
		query = '';
		muscle = '';
		open = false;
	}
</script>

<Sheet bind:open {title}>
	<div class="flex flex-col gap-3">
		<SearchField label="Search exercises" bind:value={query} />

		<!-- Bled to the panel's edges so the rail scrolls the full width of the
		     sheet: inset by the body's own padding it would look like a list that
		     had been cut short rather than one that keeps going. `-mx-4` lands the
		     scroll box exactly on the padding edge, which is where the sheet clips
		     anyway, so nothing new can overflow. -->
		<ChipGroup bind:value={muscle} layout="row" label="Filter by muscle" class="-mx-4 px-4">
			{#each MUSCLES as name (name)}
				<Chip value={name}>{name}</Chip>
			{/each}
		</ChipGroup>

		<ExerciseList {query} muscle={narrowed} {similar} {lastPerformed} onpick={choose} />
	</div>
</Sheet>
