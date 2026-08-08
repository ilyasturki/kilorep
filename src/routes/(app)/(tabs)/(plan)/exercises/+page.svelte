<script lang="ts">
	import ExerciseList from '$lib/exercises/ExerciseList.svelte';
	import SearchField from '$lib/ui/SearchField.svelte';

	import type { PageProps, Snapshot } from './$types';

	/**
	 * The catalog as a place: browse by muscle, search by anything, tap through
	 * to the detail. Catalog only for now — customs are a later slice, so there
	 * is no create action here yet and the empty search state is a plain fact.
	 */
	let { data }: PageProps = $props();

	let query = $state('');

	/**
	 * The search survives a trip into an exercise and back.
	 *
	 * It is not a nicety here, it is what makes the layout's scroll snapshot
	 * mean anything: search "row", scroll to the eighth match, tap it, come
	 * back — and an offset restored against the full catalog points at a
	 * different exercise entirely. The two have to return together or neither
	 * should. Restored second, in the same pass, which is why the layout waits
	 * a `tick` before it writes its offset.
	 */
	export const snapshot: Snapshot<string> = {
		capture: () => query,
		restore: (value) => {
			query = value;
		}
	};
</script>

<svelte:head>
	<title>Exercises | Kilorep</title>
</svelte:head>

<main class="column-content flex min-h-full flex-col gap-4 px-3 pt-3 pb-4">
	<!-- The field stands under the segment, on the page, and the bar above keeps
	     its title.

	     It has been in three places. A sticky strip here, pinned because search
	     is the act this screen exists for — which bought its permanence by
	     covering the first row of the list with a copy of the chrome one line
	     below the real one. Then the bar, which took the strip's seam out and
	     paid for the row by putting the title off screen — so the Plan tab had
	     one chrome on Templates and a different one here, and switching halves
	     changed the shape of the top of the app rather than its contents.

	     Here it is the same shape on both halves and the field is read where the
	     segment is: on arrival, before the list is touched. Not pinned, for the
	     reason the segment is not — a query is typed once and the results are
	     what you scroll, and a second strip of chrome under the real one is what
	     both earlier attempts were. It sits ~100px lower than the bar did, which
	     is a text field moved toward the thumb rather than away from it. -->
	<SearchField label="Search exercises" bind:value={query} class="w-full lg:w-80" />

	<ExerciseList {query} lastPerformed={data.lastPerformed} />
</main>
