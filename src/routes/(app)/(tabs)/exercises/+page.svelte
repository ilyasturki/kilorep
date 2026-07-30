<script lang="ts">
	import ExerciseList from '$lib/exercises/ExerciseList.svelte';
	import SearchField from '$lib/ui/SearchField.svelte';

	/**
	 * The catalog as a place: browse by muscle, search by anything, tap through
	 * to the detail. Catalog only for now — customs are a later slice, so there
	 * is no create action here yet and the empty search state is a plain fact.
	 */
	let query = $state('');
</script>

<svelte:head>
	<title>Exercises | Kilorep</title>
</svelte:head>

<main class="mx-auto flex min-h-full w-full max-w-md flex-col gap-4 px-3 pt-safe-t pb-4">
	<header class="px-1 pt-6">
		<h1 class="text-2xl font-extrabold tracking-tight">Exercises</h1>
	</header>

	<!-- Sticky so the field survives a long scroll through Quads: search is the
	     screen's primary act and must never be a scroll away. -->
	<div class="sticky top-0 z-10 -mx-3 bg-canvas px-3 py-2">
		<SearchField label="Search exercises" bind:value={query} />
	</div>

	<ExerciseList {query} />
</main>
