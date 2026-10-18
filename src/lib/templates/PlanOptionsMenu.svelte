<script lang="ts">
	import { hasGrips } from '$lib/domain/grip';
	import { exerciseHref } from '$lib/exercises/link';
	import GripField from '$lib/workout/GripField.svelte';
	import type { Planned } from '$lib/templates/plan';
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import Switch from '$lib/ui/Switch.svelte';
	import ArrowsLeftRight from '$lib/ui/icons/ArrowsLeftRight.svelte';
	import ArrowsMerge from '$lib/ui/icons/ArrowsMerge.svelte';
	import ArrowsSplit from '$lib/ui/icons/ArrowsSplit.svelte';
	import Eye from '$lib/ui/icons/Eye.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	type Props = {
		open?: boolean;
		group: Planned | null;
		superset: boolean;
		anchor?: HTMLElement | null;
		onswap: () => void;
		onsuperset: () => void;
		onbreak: () => void;
		onremove: () => void;
		ongrip: (grip: string) => void;
		from?: string;
		onoptional: (optional: boolean) => void;
	};

	let {
		open = $bindable(false),
		group,
		superset,
		anchor = null,
		onswap,
		onsuperset,
		onbreak,
		onremove,
		ongrip,
		from,
		onoptional
	}: Props = $props();

	const name = $derived(group === null ? 'Exercise' : group.meta.name);

	const meta = $derived(group?.meta);

	const pairing = $derived(superset ? onbreak : onsuperset);
</script>

<Menu bind:open title={name} {anchor}>
	{#if hasGrips(meta) && group !== null}
		<GripField
			{meta}
			value={group.exercise.grip}
			note="Prescribed"
			onpick={(grip) => {
				open = false;
				ongrip(grip);
			}}
		/>
	{/if}

	{#if group !== null}
		<Switch
			label="Optional"
			description="Skipped unless you tap it"
			bind:checked={() => group.exercise.optional === true, onoptional}
			class="px-1"
		/>
	{/if}

	<MenuItem
		href={group === null ? undefined : exerciseHref(group.meta.id, group.exercise.grip, from)}
		onselect={() => (open = false)}
	>
		<Eye size={18} />
		View exercise
	</MenuItem>
	<MenuItem
		onselect={() => {
			open = false;
			onswap();
		}}
	>
		<ArrowsLeftRight size={18} />
		Swap exercise
	</MenuItem>
	<MenuItem
		onselect={() => {
			open = false;
			pairing();
		}}
	>
		{#if superset}
			<ArrowsSplit size={18} />
			Break superset
		{:else}
			<ArrowsMerge size={18} />
			Superset with…
		{/if}
	</MenuItem>
	<MenuItem
		destructive
		onselect={() => {
			open = false;
			onremove();
		}}
	>
		<Trash size={18} />
		Remove exercise
	</MenuItem>
</Menu>
