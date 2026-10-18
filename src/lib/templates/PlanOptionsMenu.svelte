<script lang="ts">
	import { hasGrips } from '$lib/domain/grip';
	import { exerciseHref } from '$lib/exercises/link';
	import GripField from '$lib/workout/GripField.svelte';
	import type { Planned } from '$lib/templates/plan';
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import Switch from '$lib/ui/Switch.svelte';
	import ArrowElbowDownRight from '$lib/ui/icons/ArrowElbowDownRight.svelte';
	import ArrowsDownUp from '$lib/ui/icons/ArrowsDownUp.svelte';
	import ArrowsLeftRight from '$lib/ui/icons/ArrowsLeftRight.svelte';
	import ArrowsMerge from '$lib/ui/icons/ArrowsMerge.svelte';
	import ArrowsSplit from '$lib/ui/icons/ArrowsSplit.svelte';
	import Eye from '$lib/ui/icons/Eye.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	type Act = (() => void) | undefined;

	type Props = {
		open?: boolean;
		group: Planned | null;
		superset: boolean;
		anchor?: HTMLElement | null;
		onswap: () => void;
		onsuperset: () => void;
		/** A superset of three or more; with two, leaving is already breaking. */
		onbreak?: () => void;
		onleave: () => void;
		onahead?: () => void;
		onbehind?: () => void;
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
		onleave,
		onahead,
		onbehind,
		onremove,
		ongrip,
		from,
		onoptional
	}: Props = $props();

	const name = $derived(group === null ? 'Exercise' : group.meta.name);

	const meta = $derived(group?.meta);

	function act(go: Act) {
		open = false;
		go?.();
	}
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
	{#if superset && onahead !== undefined}
		<MenuItem onselect={() => act(onahead)}>
			<ArrowsDownUp size={18} />
			Move ahead in superset
		</MenuItem>
	{/if}
	{#if superset && onbehind !== undefined}
		<MenuItem onselect={() => act(onbehind)}>
			<ArrowsDownUp size={18} />
			Move back in superset
		</MenuItem>
	{/if}
	<MenuItem onselect={() => act(onswap)}>
		<ArrowsLeftRight size={18} />
		Swap exercise
	</MenuItem>
	{#if superset}
		<MenuItem onselect={() => act(onleave)}>
			<ArrowElbowDownRight size={18} />
			Remove from superset
		</MenuItem>
		{#if onbreak !== undefined}
			<MenuItem onselect={() => act(onbreak)}>
				<ArrowsSplit size={18} />
				Break superset
			</MenuItem>
		{/if}
	{:else}
		<MenuItem onselect={() => act(onsuperset)}>
			<ArrowsMerge size={18} />
			Superset with…
		</MenuItem>
	{/if}
	<MenuItem destructive onselect={() => act(onremove)}>
		<Trash size={18} />
		Remove exercise
	</MenuItem>
</Menu>
