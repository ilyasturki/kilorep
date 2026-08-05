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
	<!-- Sticky so the field survives a long scroll through Quads: search is the
	     screen's primary act and must never be a scroll away. -->
	<div class="sticky top-0 z-10 -mx-3 bg-canvas px-3 py-2">
		<SearchField label="Search exercises" bind:value={query} />
	</div>

	<ExerciseList {query} lastPerformed={data.lastPerformed} />
</main>
