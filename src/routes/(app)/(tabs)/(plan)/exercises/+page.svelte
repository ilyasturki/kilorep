<script lang="ts">
	import ExerciseList from '$lib/exercises/ExerciseList.svelte';
	import { fillAppBar } from '$lib/nav/bar.svelte';
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
	 * The field lives in the bar, not on the page.
	 *
	 * It was a sticky strip at the top of this screen, pinned there because
	 * search is the act this screen exists for and must never be a scroll away.
	 * The bar is where that argument actually leads: sticky bought the same
	 * permanence by covering the first row of the list with a copy of the chrome
	 * one line below the real one, and 56px of a phone's screen went to the seam
	 * between them.
	 *
	 * One field, rendered once. `wideAction` gives it the phone row the title
	 * steps out of; at `lg` it is the bar's last track, sized here because the
	 * bar has no business knowing how wide a search field wants to be.
	 */
	fillAppBar(() => ({ action: search, wideAction: true }));

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

{#snippet search()}
	<SearchField label="Search exercises" bind:value={query} class="w-full lg:w-64" />
{/snippet}

<svelte:head>
	<title>Exercises | Kilorep</title>
</svelte:head>

<main class="column-content flex min-h-full flex-col gap-4 px-3 pt-3 pb-4">
	<ExerciseList {query} lastPerformed={data.lastPerformed} />
</main>
