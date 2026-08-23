<script lang="ts">
	import ExerciseList from '$lib/exercises/ExerciseList.svelte';
	import SearchField from '$lib/ui/SearchField.svelte';

	import type { PageProps, Snapshot } from './$types';

	let { data }: PageProps = $props();

	let query = $state('');

	// The layout's scroll snapshot restores against the filtered list, so it
	// waits a tick for this query to be restored first.
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
	<SearchField label="Search exercises" bind:value={query} class="w-full lg:w-80" />

	<ExerciseList {query} lastPerformed={data.lastPerformed} />
</main>
