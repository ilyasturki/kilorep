<script lang="ts">
	import { hasGrips } from '$lib/domain/grip';
	import type { Group } from '$lib/workout/groups';
	import GripField from '$lib/workout/GripField.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import ArrowsLeftRight from '$lib/ui/icons/ArrowsLeftRight.svelte';
	import ArrowsMerge from '$lib/ui/icons/ArrowsMerge.svelte';
	import ArrowsSplit from '$lib/ui/icons/ArrowsSplit.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	type Props = {
		open?: boolean;
		group: Group | null;
		superset?: boolean;
		anchor?: HTMLElement | null;
		onswap: () => void;
		onsuperset?: () => void;
		onbreak?: () => void;
		onremove: () => void;
		ongrip?: (grip: string) => void;
	};

	let {
		open = $bindable(false),
		group,
		superset = false,
		anchor = null,
		onswap,
		onsuperset,
		onbreak,
		onremove,
		ongrip
	}: Props = $props();

	let confirmingSwap = $state(false);
	let confirmingRemove = $state(false);

	const name = $derived(group === null ? 'Exercise' : group.meta.name);

	const meta = $derived(group?.meta);

	const gripped = $derived(hasGrips(meta) && ongrip !== undefined);

	const logged = $derived(
		group === null ? 0 : group.cursors.filter((cursor) => cursor.set.completed).length
	);

	const lost = $derived(
		logged === 1
			? '1 logged set goes with it, and nothing in the app can put it back.'
			: `${logged} logged sets go with it, and nothing in the app can put them back.`
	);

	function swap() {
		open = false;

		if (logged > 0) {
			confirmingSwap = true;
			return;
		}

		onswap();
	}

	function remove() {
		open = false;

		if (logged > 0) {
			confirmingRemove = true;
			return;
		}

		onremove();
	}

	const pairing = $derived(superset ? onbreak : onsuperset);

	function pair() {
		open = false;
		pairing?.();
	}
</script>

<Menu bind:open title={name} {anchor}>
	{#if gripped && group !== null}
		<GripField
			{meta}
			value={group.grip}
			note="Sets still to come"
			onpick={(grip) => {
				open = false;
				ongrip?.(grip);
			}}
		/>
	{/if}

	<MenuItem onselect={swap}>
		<ArrowsLeftRight size={18} />
		Swap exercise
	</MenuItem>
	{#if pairing !== undefined}
		<MenuItem onselect={pair}>
			{#if superset}
				<ArrowsSplit size={18} />
				Break superset
			{:else}
				<ArrowsMerge size={18} />
				Superset with…
			{/if}
		</MenuItem>
	{/if}
	<MenuItem destructive onselect={remove}>
		<Trash size={18} />
		Remove exercise
	</MenuItem>
</Menu>

<AlertDialog
	bind:open={confirmingSwap}
	title="Swap {name}?"
	description={lost}
	confirmLabel="Swap"
	onconfirm={onswap}
/>

<AlertDialog
	bind:open={confirmingRemove}
	title="Remove {name}?"
	description={lost}
	confirmLabel="Remove"
	onconfirm={onremove}
/>
