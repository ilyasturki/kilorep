<script lang="ts">
	import { hasGrips } from '$lib/domain/grip';
	import type { Group } from '$lib/workout/groups';
	import GripField from '$lib/workout/GripField.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import ArrowFatDown from '$lib/ui/icons/ArrowFatDown.svelte';
	import ArrowFatUp from '$lib/ui/icons/ArrowFatUp.svelte';
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
		onmoveup?: () => void;
		onmovedown?: () => void;
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
		ongrip,
		onmoveup,
		onmovedown
	}: Props = $props();

	let confirmingSwap = $state(false);
	let confirmingRemove = $state(false);

	// What the menu shows freezes the moment it closes: every action shuts it before it runs,
	// and some — swap, remove — take the exercise with them, which would empty the sheet while
	// it is still sliding out. The exit shows what the tap acted on, not the lookup's null.
	let held: {
		group: Group | null;
		superset: boolean;
		up: (() => void) | undefined;
		down: (() => void) | undefined;
	} = { group: null, superset: false, up: undefined, down: undefined };

	const view = $derived.by(() => {
		if (open && group !== null) {
			held = { group, superset, up: onmoveup, down: onmovedown };
		}

		return held;
	});

	const name = $derived(view.group === null ? 'Exercise' : view.group.meta.name);

	const meta = $derived(view.group?.meta);

	const gripped = $derived(hasGrips(meta) && ongrip !== undefined);

	const logged = $derived(
		view.group === null ? 0 : view.group.cursors.filter((cursor) => cursor.set.completed).length
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

	const pairing = $derived(view.superset ? onbreak : onsuperset);

	function pair() {
		open = false;
		pairing?.();
	}

	function move(go: (() => void) | undefined) {
		open = false;
		go?.();
	}
</script>

<Menu bind:open title={name} {anchor}>
	{#if gripped && view.group !== null}
		<GripField
			{meta}
			value={view.group.grip}
			note="Sets still to come"
			onpick={(grip) => {
				open = false;
				ongrip?.(grip);
			}}
		/>
	{/if}

	{#if view.up !== undefined}
		<MenuItem onselect={() => move(view.up)}>
			<ArrowFatUp size={18} />
			Move up
		</MenuItem>
	{/if}
	{#if view.down !== undefined}
		<MenuItem onselect={() => move(view.down)}>
			<ArrowFatDown size={18} />
			Move down
		</MenuItem>
	{/if}
	<MenuItem onselect={swap}>
		<ArrowsLeftRight size={18} />
		Swap exercise
	</MenuItem>
	{#if pairing !== undefined}
		<MenuItem onselect={pair}>
			{#if view.superset}
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
