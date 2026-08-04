<script lang="ts">
	import { catalog, catalogById } from '$lib/catalog';
	import { MUSCLES } from '$lib/domain/exercise';
	import type { Exercise, Muscle } from '$lib/domain/exercise';
	import type { MainVariants } from '$lib/domain/preference';
	import ExerciseList from '$lib/exercises/ExerciseList.svelte';
	import { similarTo } from '$lib/exercises/browse';
	import type { LastPerformed } from '$lib/store/derive';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import ChipGroup from '$lib/ui/ChipGroup.svelte';
	import SearchField from '$lib/ui/SearchField.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';

	type Props = {
		open?: boolean;
		title: string;
		replacing?: Exercise | null;
		frequent?: string[];
		pinned?: { title: string; exercises: Exercise[] } | null;
		multiple?: boolean;
		verb?: string;
		lastPerformed: LastPerformed;
		mains: MainVariants;
		onpick: (exerciseIds: string[]) => void;
	};

	let {
		open = $bindable(false),
		title,
		replacing = null,
		frequent = [],
		pinned = null,
		multiple = false,
		verb = 'Add',
		lastPerformed,
		mains,
		onpick
	}: Props = $props();

	const shelf = $derived.by(() => {
		if (pinned !== null) {
			return pinned;
		}

		if (replacing !== null) {
			return { title: 'Similar', exercises: similarTo(catalog, replacing) };
		}

		const exercises = frequent
			.map((id) => catalogById[id])
			.filter((exercise) => exercise !== undefined);

		return exercises.length === 0 ? null : { title: 'Trained most', exercises };
	});

	let query = $state('');

	let muscle = $state('');

	const narrowed = $derived(muscle === '' ? null : (muscle as Muscle));

	let picks = $state<string[]>([]);

	const picked = $derived(new Set(picks));

	function reset() {
		query = '';
		muscle = '';
		picks = [];
	}

	function choose(exercise: Exercise) {
		if (!multiple) {
			onpick([exercise.id]);
			reset();
			open = false;

			return;
		}

		picks = picks.includes(exercise.id)
			? picks.filter((id) => id !== exercise.id)
			: [...picks, exercise.id];
	}

	function commit() {
		onpick(picks);
		reset();
		open = false;
	}

	$effect(() => {
		if (!open) {
			reset();
		}
	});

	const label = $derived(
		picks.length === 1 ? `${verb} 1 exercise` : `${verb} ${picks.length} exercises`
	);
</script>

{#snippet addBar()}
	<Button variant="commit" class="w-full" onclick={commit}>{label}</Button>
{/snippet}

<Sheet bind:open {title} footer={multiple && picks.length > 0 ? addBar : undefined}>
	<div class="flex flex-col gap-3">
		<SearchField label="Search exercises" bind:value={query} />

		<ChipGroup bind:value={muscle} layout="row" label="Filter by muscle" class="-mx-4 px-4">
			{#each MUSCLES as name (name)}
				<Chip value={name}>{name}</Chip>
			{/each}
		</ChipGroup>

		<ExerciseList
			{query}
			muscle={narrowed}
			{shelf}
			{lastPerformed}
			{mains}
			selected={multiple ? picked : undefined}
			onpick={choose}
		/>
	</div>
</Sheet>
