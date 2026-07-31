<script lang="ts">
	import type { Exercise } from '$lib/domain/exercise';
	import ExerciseList from '$lib/exercises/ExerciseList.svelte';
	import SearchField from '$lib/ui/SearchField.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';

	/**
	 * The catalog behind a search field, one tap to pick.
	 *
	 * Two questions, one sheet: which exercise to add to the session, and which
	 * one to swap an entry for. They differ in the title and in what the screen
	 * does with the answer, and in nothing else — a second copy would be a
	 * second search field to keep in step with the first.
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
		onpick: (exerciseId: string) => void;
	};

	let { open = $bindable(false), title, onpick }: Props = $props();

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
		<ExerciseList {query} onpick={choose} />
	</div>
</Sheet>
