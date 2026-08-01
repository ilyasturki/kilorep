<script lang="ts">
	import { catalog } from '$lib/catalog';
	import type { Exercise } from '$lib/domain/exercise';
	import ExerciseList from '$lib/exercises/ExerciseList.svelte';
	import { similarTo } from '$lib/exercises/browse';
	import type { LastPerformed } from '$lib/store/derive';
	import SearchField from '$lib/ui/SearchField.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';

	/**
	 * The catalog behind a search field, one tap to pick.
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

	// Picking is the whole reason the sheet was opened, so it closes behind the
	// tap — and the query resets, because the next one is a new question.
	function choose(exercise: Exercise) {
		onpick(exercise.id);
		query = '';
		open = false;
	}
</script>

<Sheet bind:open {title}>
	<div class="flex flex-col gap-3">
		<SearchField label="Search exercises" bind:value={query} />
		<ExerciseList {query} {similar} {lastPerformed} onpick={choose} />
	</div>
</Sheet>
