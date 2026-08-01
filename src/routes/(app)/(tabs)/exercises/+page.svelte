<script lang="ts">
	import ExerciseList from '$lib/exercises/ExerciseList.svelte';
	import SearchField from '$lib/ui/SearchField.svelte';

	import type { PageProps } from './$types';

	/**
	 * The catalog as a place: browse by muscle, search by anything, tap through
	 * to the detail. Catalog only for now — customs are a later slice, so there
	 * is no create action here yet and the empty search state is a plain fact.
	 */
	let { data }: PageProps = $props();

	let query = $state('');
</script>

<svelte:head>
	<title>Exercises | Kilorep</title>
</svelte:head>

<main class="column-content flex min-h-full flex-col gap-4 px-3 pt-safe-t pb-4 lg:pt-3">
	<!-- Gone from `lg` up: the bar above already says Exercises, in the tab that
	     is currently lit. The bar names the place and the page names the
	     content — which is why the detail screen keeps its heading and this one
	     does not. On a phone there is no bar overhead and the heading is the
	     anchor above the search field, so it stays. -->
	<header class="px-1 pt-6 lg:hidden">
		<h1 class="text-2xl font-extrabold tracking-tight">Exercises</h1>
	</header>

	<!-- Sticky so the field survives a long scroll through Quads: search is the
	     screen's primary act and must never be a scroll away. -->
	<div class="sticky top-0 z-10 -mx-3 bg-canvas px-3 py-2">
		<SearchField label="Search exercises" bind:value={query} />
	</div>

	<ExerciseList {query} lastPerformed={data.lastPerformed} />
</main>
