<script lang="ts">
	import { catalog } from '$lib/catalog';
	import type { Equipment } from '$lib/domain/exercise';
	import ExerciseLedger from '$lib/exercises/ExerciseLedger.svelte';
	import type { LedgerSort } from '$lib/exercises/ExerciseLedger.svelte';
	import ExerciseList from '$lib/exercises/ExerciseList.svelte';
	import PlanTabs from '$lib/nav/PlanTabs.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import SearchField from '$lib/ui/SearchField.svelte';
	import CaretDown from '$lib/ui/icons/CaretDown.svelte';
	import { deskViewport } from '$lib/ui/viewport';

	import type { PageProps, Snapshot } from './$types';

	let { data }: PageProps = $props();

	let query = $state('');

	// Desktop ledger controls. Harmless leftovers on a phone: the pills that set them only
	// render on the wide layout.
	let equipment = $state<Equipment | ''>('');
	let sort = $state<LedgerSort>('muscle');

	const EQUIPMENT = [...new Set(catalog.map((exercise) => exercise.equipment))];

	const SORTS: { value: LedgerSort; label: string }[] = [
		{ value: 'muscle', label: 'Muscle' },
		{ value: 'name', label: 'Name' },
		{ value: 'recent', label: 'Recently trained' }
	];

	let equipmentOpen = $state(false);
	let sortOpen = $state(false);

	let equipmentAnchor = $state<HTMLElement | null>(null);
	let sortAnchor = $state<HTMLElement | null>(null);

	const sortLabel = $derived(SORTS.find((option) => option.value === sort)?.label ?? 'Muscle');

	type Kept = { query: string; equipment: Equipment | ''; sort: LedgerSort };

	// The layout's scroll snapshot restores against the filtered list, so it waits a tick for
	// these to be restored first.
	export const snapshot: Snapshot<Kept> = {
		capture: () => ({ query, equipment, sort }),
		restore: (value) => {
			if (typeof value === 'string') {
				// An older snapshot kept the query alone.
				query = value;

				return;
			}

			query = value.query;
			equipment = value.equipment;
			sort = value.sort;
		}
	};
</script>

<svelte:head>
	<title>Exercises | Kilorep</title>
</svelte:head>

<main class="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-4 px-3 pt-3 pb-4 lg:max-w-5xl">
	{#if deskViewport.current}
		<div class="flex items-center justify-between gap-4">
			<PlanTabs value="/plan/exercises" class="w-72 shrink-0" />

			<div class="flex min-w-0 items-center gap-2.5">
				<Button
					variant="chrome"
					class="gap-2"
					onclick={() => (equipmentOpen = true)}
					{@attach (node) => void (equipmentAnchor = node)}
				>
					{equipment === '' ? 'All equipment' : equipment}
					<CaretDown size={14} />
				</Button>

				<Button
					variant="chrome"
					class="gap-2"
					onclick={() => (sortOpen = true)}
					{@attach (node) => void (sortAnchor = node)}
				>
					Sort · {sortLabel}
					<CaretDown size={14} />
				</Button>

				<SearchField label="Search exercises" bind:value={query} class="w-80" />
			</div>
		</div>

		<ExerciseLedger
			{query}
			{equipment}
			{sort}
			lastPerformed={data.lastPerformed}
			heaviest={data.heaviest}
		/>

		<Menu bind:open={equipmentOpen} title="Filter by equipment" anchor={equipmentAnchor}>
			<MenuItem onselect={() => (equipment = '')}>All equipment</MenuItem>

			{#each EQUIPMENT as option (option)}
				<MenuItem onselect={() => (equipment = option)}>{option}</MenuItem>
			{/each}
		</Menu>

		<Menu bind:open={sortOpen} title="Sort exercises" anchor={sortAnchor}>
			{#each SORTS as option (option.value)}
				<MenuItem onselect={() => (sort = option.value)}>{option.label}</MenuItem>
			{/each}
		</Menu>
	{:else}
		<PlanTabs value="/plan/exercises" />

		<SearchField label="Search exercises" bind:value={query} class="w-full" />

		<ExerciseList {query} lastPerformed={data.lastPerformed} />
	{/if}
</main>
