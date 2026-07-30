<script lang="ts">
	import type { Exercise } from '$lib/domain/exercise';
	import ExerciseList from '$lib/exercises/ExerciseList.svelte';
	import SearchField from '$lib/ui/SearchField.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';

	/**
	 * Mid-workout insert: the catalog behind a search field, one tap to add.
	 *
	 * The same `ExerciseList` the Exercises screen uses — browse folded by
	 * family, search flat and ranked — with the rows picking instead of
	 * navigating. Tapping a family row takes the canonical parent immediately;
	 * the variants sit behind the same expander as everywhere else. In-gym
	 * rule: the common case is one tap after typing three letters.
	 */
	type Props = {
		open?: boolean;
		onadd: (exerciseId: string) => void;
	};

	let { open = $bindable(false), onadd }: Props = $props();

	let query = $state('');

	// Adding is the whole reason the sheet was opened, so it closes behind the
	// tap — and the query resets, because the next insert is a new question.
	function pick(exercise: Exercise) {
		onadd(exercise.id);
		query = '';
		open = false;
	}
</script>

<Sheet bind:open title="Add exercise">
	<div class="flex flex-col gap-3">
		<SearchField label="Search exercises" bind:value={query} />
		<ExerciseList {query} onpick={pick} />
	</div>
</Sheet>
