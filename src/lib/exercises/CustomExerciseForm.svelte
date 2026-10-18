<script lang="ts">
	import { catalog } from '$lib/catalog';
	import type { CustomDraft } from '$lib/domain/custom';
	import { sameName } from '$lib/domain/custom';
	import { EQUIPMENT, MUSCLES } from '$lib/domain/exercise';
	import type { Equipment, LoadMode, Muscle } from '$lib/domain/exercise';
	import { exerciseCatalog } from '$lib/exercises/catalog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import ChipGroup from '$lib/ui/ChipGroup.svelte';
	import Input from '$lib/ui/Input.svelte';
	import Select from '$lib/ui/Select.svelte';

	type Props = {
		/** The exercise being edited, or null for a new one. */
		self?: string | null;
		initial: CustomDraft | null;
		/** A new one starts from what was searched for. */
		name?: string;
		saveLabel: string;
		onsave: (draft: CustomDraft) => Promise<void> | void;
		oncancel?: () => void;
	};

	let { self = null, initial, name: seed = '', saveLabel, onsave, oncancel }: Props = $props();

	const LOADS: { value: LoadMode; label: string }[] = [
		{ value: 'total', label: 'Total' },
		{ value: 'per-hand', label: 'Per hand' },
		{ value: 'unilateral', label: 'One side' }
	];

	const NONE = 'none';

	// A search is typed in lowercase; the catalog's names are not. Mixed case is left as typed.
	function titled(query: string): string {
		const text = query.trim().replaceAll(/\s+/gu, ' ');

		return text === text.toLowerCase()
			? text
					.split(' ')
					.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
					.join(' ')
			: text;
	}

	// Catalog roots only: a family is one level deep, and a custom hangs beside the variants.
	const parents = [
		{ value: NONE, label: 'None' },
		...catalog
			.filter((exercise) => exercise.variantOf === undefined)
			.toSorted((a, b) => a.name.localeCompare(b.name))
			.map((exercise) => ({ value: exercise.id, label: exercise.name }))
	];

	// svelte-ignore state_referenced_locally
	let name = $state(initial === null ? titled(seed) : initial.name);
	// svelte-ignore state_referenced_locally
	let equipment = $state<string>(initial === null ? '' : initial.equipment);
	// svelte-ignore state_referenced_locally
	let load = $state<string>(initial === null ? 'total' : initial.loadMode);
	// svelte-ignore state_referenced_locally
	let primary = $state<string>(initial === null ? '' : initial.muscles.primary);
	// svelte-ignore state_referenced_locally
	let secondary = $state<string[]>(initial === null ? [] : [...initial.muscles.secondary]);
	// svelte-ignore state_referenced_locally
	let parent = $state<string>(initial?.variantOf ?? NONE);

	// What the lifter has set by hand; naming a parent fills in only the rest.
	// svelte-ignore state_referenced_locally
	const touched = new Set<string>(initial === null ? [] : ['equipment', 'load', 'muscles']);

	function adopt(next: string) {
		parent = next;

		const named = exerciseCatalog.current.byId[next];

		if (named === undefined) {
			return;
		}

		if (!touched.has('equipment')) {
			equipment = named.equipment;
		}

		if (!touched.has('load')) {
			load = named.loadMode;
		}

		if (!touched.has('muscles')) {
			primary = named.muscles.primary;
			secondary = [...named.muscles.secondary];
		}
	}

	const taken = $derived(sameName(exerciseCatalog.current.exercises, name, self));

	const nameError = $derived(
		taken === undefined ? undefined : `Already in the list as ${taken.name}.`
	);

	const ready = $derived(
		name.trim() !== '' && taken === undefined && equipment !== '' && primary !== ''
	);

	let saving = $state(false);

	async function save() {
		if (!ready || saving) {
			return;
		}

		saving = true;

		try {
			await onsave({
				name,
				equipment: equipment as Equipment,
				loadMode: load as LoadMode,
				muscles: {
					primary: primary as Muscle,
					secondary: secondary.filter((muscle) => muscle !== primary) as Muscle[]
				},
				variantOf: parent === NONE ? null : parent
			});
		} finally {
			saving = false;
		}
	}
</script>

<form
	class="flex flex-col gap-5"
	onsubmit={(event) => {
		event.preventDefault();
		void save();
	}}
>
	<Input
		label="Name"
		bind:value={name}
		error={nameError}
		placeholder="Landmine Press"
		autocomplete="off"
		autocapitalize="words"
		maxlength={60}
	/>

	<Select
		label="Variant of"
		items={parents}
		bind:value={() => parent, (next) => adopt(typeof next === 'string' ? next : NONE)}
	/>

	<div class="flex flex-col gap-2">
		<span class="label-caps">Equipment</span>
		<ChipGroup
			label="Equipment"
			bind:value={
				() => equipment,
				(next) => {
					if (typeof next === 'string' && next !== '') {
						touched.add('equipment');
						equipment = next;
					}
				}
			}
		>
			{#each EQUIPMENT as option (option)}
				<Chip value={option}>{option}</Chip>
			{/each}
		</ChipGroup>
	</div>

	<div class="flex flex-col gap-2">
		<span class="label-caps">Weight</span>
		<ChipGroup
			label="Weight"
			bind:value={
				() => load,
				(next) => {
					if (typeof next === 'string' && next !== '') {
						touched.add('load');
						load = next;
					}
				}
			}
		>
			{#each LOADS as option (option.value)}
				<Chip value={option.value}>{option.label}</Chip>
			{/each}
		</ChipGroup>
	</div>

	<div class="flex flex-col gap-2">
		<span class="label-caps">Main muscle</span>
		<ChipGroup
			label="Main muscle"
			bind:value={
				() => primary,
				(next) => {
					if (typeof next === 'string' && next !== '') {
						touched.add('muscles');
						primary = next;
						secondary = secondary.filter((muscle) => muscle !== next);
					}
				}
			}
		>
			{#each MUSCLES as option (option)}
				<Chip value={option}>{option}</Chip>
			{/each}
		</ChipGroup>
	</div>

	{#if primary !== ''}
		<div class="flex flex-col gap-2">
			<span class="label-caps">Also works</span>
			<ChipGroup
				type="multiple"
				label="Also works"
				bind:value={
					() => secondary,
					(next) => {
						if (Array.isArray(next)) {
							touched.add('muscles');
							secondary = next;
						}
					}
				}
			>
				{#each MUSCLES.filter((muscle) => muscle !== primary) as option (option)}
					<Chip value={option}>{option}</Chip>
				{/each}
			</ChipGroup>
		</div>
	{/if}

	<div class="flex gap-2">
		{#if oncancel !== undefined}
			<Button type="button" variant="secondary" class="flex-1" onclick={oncancel}>Cancel</Button>
		{/if}

		<Button type="submit" variant="commit" class="flex-[2]" disabled={!ready || saving}>
			{saveLabel}
		</Button>
	</div>
</form>
