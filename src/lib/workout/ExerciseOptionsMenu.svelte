<script lang="ts">
	import { hasGrips, settleGrip } from '$lib/domain/grip';
	import { exerciseHref } from '$lib/exercises/link';
	import type { Group } from '$lib/workout/groups';
	import GripField from '$lib/workout/GripField.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import ArrowFatDown from '$lib/ui/icons/ArrowFatDown.svelte';
	import ArrowFatUp from '$lib/ui/icons/ArrowFatUp.svelte';
	import ArrowElbowDownRight from '$lib/ui/icons/ArrowElbowDownRight.svelte';
	import ArrowsDownUp from '$lib/ui/icons/ArrowsDownUp.svelte';
	import ArrowsLeftRight from '$lib/ui/icons/ArrowsLeftRight.svelte';
	import ArrowsMerge from '$lib/ui/icons/ArrowsMerge.svelte';
	import ArrowsSplit from '$lib/ui/icons/ArrowsSplit.svelte';
	import Eye from '$lib/ui/icons/Eye.svelte';
	import Fire from '$lib/ui/icons/Fire.svelte';
	import Pencil from '$lib/ui/icons/Pencil.svelte';
	import RowsPlusBottom from '$lib/ui/icons/RowsPlusBottom.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	type Props = {
		open?: boolean;
		group: Group | null;
		superset?: boolean;
		anchor?: HTMLElement | null;
		/**
		 * The address the exercise's own page walks back to. Set, the sheet carries the way to
		 * that page — which is the tap the heading used to be, now that tapping it opens this.
		 */
		from?: string;
		onswap: () => void;
		onsuperset?: () => void;
		/** A superset of three or more; with two, leaving is already breaking. */
		onbreak?: () => void;
		onremove: () => void;
		ongrip?: (grip: string) => void;
		onmoveup?: () => void;
		onmovedown?: () => void;
		onwarmup?: () => void;
		onnote?: () => void;
		/** A superset leg's own add set: its block's add row adds a round. */
		onaddset?: () => void;
		onleave?: () => void;
		onahead?: () => void;
		onbehind?: () => void;
		/** A draft's edit, which Discard takes back: nothing to ask before it. */
		undoable?: boolean;
	};

	let {
		open = $bindable(false),
		group,
		superset = false,
		anchor = null,
		from,
		onswap,
		onsuperset,
		onbreak,
		onremove,
		ongrip,
		onmoveup,
		onmovedown,
		onwarmup,
		onnote,
		onaddset,
		onleave,
		onahead,
		onbehind,
		undoable = false
	}: Props = $props();

	let confirmingRemove = $state(false);

	// What the menu shows freezes the moment it closes: every action shuts it before it runs,
	// and some — swap, remove — take the exercise with them, which would empty the sheet while
	// it is still sliding out. The exit shows what the tap acted on, not the lookup's null.
	type Act = (() => void) | undefined;

	let held: {
		group: Group | null;
		superset: boolean;
		up: Act;
		down: Act;
		add: Act;
		leave: Act;
		ahead: Act;
		behind: Act;
		split: Act;
	} = {
		group: null,
		superset: false,
		up: undefined,
		down: undefined,
		add: undefined,
		leave: undefined,
		ahead: undefined,
		behind: undefined,
		split: undefined
	};

	const view = $derived.by(() => {
		if (open && group !== null) {
			held = {
				group,
				superset,
				up: onmoveup,
				down: onmovedown,
				add: onaddset,
				leave: onleave,
				ahead: onahead,
				behind: onbehind,
				split: onbreak
			};
		}

		return held;
	});

	const name = $derived(view.group === null ? 'Exercise' : view.group.meta.name);

	const meta = $derived(view.group?.meta);

	const gripped = $derived(hasGrips(meta) && ongrip !== undefined);

	const details = $derived(
		meta === undefined ? null : exerciseHref(meta.id, settleGrip(meta, view.group?.grip), from)
	);

	const logged = $derived(
		view.group === null ? 0 : view.group.cursors.filter((cursor) => cursor.set.completed).length
	);

	const lost = $derived(
		logged === 1
			? '1 logged set goes with it, and nothing in the app can put it back.'
			: `${logged} logged sets go with it, and nothing in the app can put them back.`
	);

	// What becomes of logged sets is asked once the replacement is known, by name.
	function swap() {
		open = false;
		onswap();
	}

	function remove() {
		open = false;

		if (logged > 0 && !undoable) {
			confirmingRemove = true;
			return;
		}

		onremove();
	}

	function act(go: Act) {
		open = false;
		go?.();
	}

	const noted = $derived(view.group !== null && view.group.note !== undefined);
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

	<!-- First, and a link: tapping the heading opens this sheet now, so the page the heading
	     used to reach has to be the first thing the sheet offers back. -->
	{#if details !== null}
		<MenuItem href={details} onselect={() => (open = false)}>
			<Eye size={18} />
			View exercise
		</MenuItem>
	{/if}

	{#if onwarmup !== undefined}
		<MenuItem onselect={() => act(onwarmup)}>
			<Fire size={18} />
			Add warmup
		</MenuItem>
	{/if}
	{#if onnote !== undefined}
		<MenuItem onselect={() => act(onnote)}>
			<Pencil size={18} />
			{noted ? 'Edit note' : 'Add note'}
		</MenuItem>
	{/if}

	{#if view.superset && view.add !== undefined}
		<MenuItem onselect={() => act(view.add)}>
			<RowsPlusBottom size={18} />
			Add set
		</MenuItem>
	{/if}

	{#if view.superset && view.ahead !== undefined}
		<MenuItem onselect={() => act(view.ahead)}>
			<ArrowsDownUp size={18} />
			Move ahead in superset
		</MenuItem>
	{/if}
	{#if view.superset && view.behind !== undefined}
		<MenuItem onselect={() => act(view.behind)}>
			<ArrowsDownUp size={18} />
			Move back in superset
		</MenuItem>
	{/if}

	{#if view.up !== undefined}
		<MenuItem onselect={() => act(view.up)}>
			<ArrowFatUp size={18} />
			Move up
		</MenuItem>
	{/if}
	{#if view.down !== undefined}
		<MenuItem onselect={() => act(view.down)}>
			<ArrowFatDown size={18} />
			Move down
		</MenuItem>
	{/if}
	<MenuItem onselect={swap}>
		<ArrowsLeftRight size={18} />
		Swap exercise
	</MenuItem>
	{#if view.superset}
		{#if view.leave !== undefined}
			<MenuItem onselect={() => act(view.leave)}>
				<ArrowElbowDownRight size={18} />
				Remove from superset
			</MenuItem>
		{/if}
		{#if view.split !== undefined}
			<MenuItem onselect={() => act(view.split)}>
				<ArrowsSplit size={18} />
				Break superset
			</MenuItem>
		{/if}
	{:else if onsuperset !== undefined}
		<MenuItem onselect={() => act(onsuperset)}>
			<ArrowsMerge size={18} />
			Superset with…
		</MenuItem>
	{/if}
	<MenuItem destructive onselect={remove}>
		<Trash size={18} />
		Remove exercise
	</MenuItem>
</Menu>

<AlertDialog
	bind:open={confirmingRemove}
	title="Remove {name}?"
	description={lost}
	confirmLabel="Remove"
	onconfirm={onremove}
/>
