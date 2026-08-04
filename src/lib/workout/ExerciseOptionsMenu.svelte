<script lang="ts">
	import type { Group } from '$lib/workout/groups';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import ArrowsLeftRight from '$lib/ui/icons/ArrowsLeftRight.svelte';
	import ArrowsMerge from '$lib/ui/icons/ArrowsMerge.svelte';
	import ArrowsSplit from '$lib/ui/icons/ArrowsSplit.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	/**
	 * What can be done to an exercise in this session: swapped for another,
	 * paired with one, unpaired from one, or taken out.
	 *
	 * Reached by the ⋯ beside the exercise's name in the block, and by
	 * right-clicking the name. `Menu` picks the container — a sheet under a
	 * thumb, an anchored list at the ⋯ under a pointer.
	 *
	 * `SetOptionsMenu` is the same surface one level down, and the two are
	 * deliberately the same shape — titled after the thing, a short list of what
	 * can happen to it — because the gesture is the same gesture and the levels
	 * differ only in what they act on.
	 *
	 * It carried a "View exercise" link for a while, and the argument for it was
	 * that the name raises a question mid-set — which grip, which machine, what
	 * did this lift last month. The name answers that itself now: it is the
	 * anchor, and a link in here would be a second door to the same room, one tap
	 * further from the thumb. What is left is the two acts that change the
	 * session, which is what an options menu is for.
	 *
	 * Swap and Remove destroy every set under the exercise, so both go through a
	 * confirm once any of them is logged: that is the only data this screen
	 * holds, and there is no undo anywhere in the app. Untouched, neither asks —
	 * the loop does not stop for a decision that costs nothing.
	 *
	 * Pairing and unpairing ask nothing at any time, and that asymmetry is the
	 * honest one: nothing is destroyed either way. A superset broken is two
	 * exercises holding exactly the sets they held, and one made is the same sets
	 * lifted in a different order — the gesture is its own undo, which is
	 * precisely what Swap and Remove lack.
	 *
	 * The group is resolved live by the screen rather than snapshotted on open,
	 * for the reason `SetOptionsMenu` gives: a menu describing a row that has
	 * since moved is worse than one that describes nothing.
	 */
	type Props = {
		open?: boolean;
		group: Group | null;
		/**
		 * Whether the entry this exercise stands in holds more than one — which
		 * decides whether the middle item offers to make a superset or to break the
		 * one it is already part of. Never both: an entry is one or the other, and
		 * a menu carrying both verbs would ask the user to work out which applied.
		 */
		superset?: boolean;
		/** The ⋯ that asked — where the anchored menu hangs. */
		anchor?: HTMLElement | null;
		onswap: () => void;
		/**
		 * Pairing, and unpairing. Both optional, and the item is drawn only for the
		 * one that was handed in: History's correction mode reaches this menu too,
		 * and that screen fixes what a session *was* rather than reshaping how it
		 * would be lifted — so it passes neither, and the menu is the two acts it
		 * has always offered.
		 */
		onsuperset?: () => void;
		onbreak?: () => void;
		onremove: () => void;
	};

	let {
		open = $bindable(false),
		group,
		superset = false,
		anchor = null,
		onswap,
		onsuperset,
		onbreak,
		onremove
	}: Props = $props();

	let confirmingSwap = $state(false);
	let confirmingRemove = $state(false);

	const name = $derived(group === null ? 'Exercise' : group.meta.name);

	const logged = $derived(
		group === null ? 0 : group.cursors.filter((cursor) => cursor.set.completed).length
	);

	// Counted and named, not "this exercise": a confirm that does not say what it
	// is about to destroy is a confirm nobody reads. Same rule the set-level
	// menu keeps, which spells out the numbers it is about to throw away.
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

	// The one pairing act this entry can be offered — never both, and undefined
	// on a screen that offers neither. Which of the two it is follows from the
	// entry, so the menu never has to be told twice.
	const pairing = $derived(superset ? onbreak : onsuperset);

	// Straight through: nothing is destroyed either way, so there is nothing to
	// confirm and no dialog to route around. Closing first is the same handover
	// Swap makes to the picker it opens.
	function pair() {
		open = false;
		pairing?.();
	}
</script>

<!-- Icons lead the labels: a short stack of verbs is read as a menu, and a
     menu is scanned by glyph before it is read. -->
<Menu bind:open title={name} {anchor}>
	<MenuItem onselect={swap}>
		<ArrowsLeftRight size={18} />
		Swap exercise
	</MenuItem>
	<!-- The pairing verb sits between the two acts that rebuild the slot and the
	     one that empties it, because that is the order of how much they cost: a
	     swap keeps the position, a pairing keeps everything, a removal keeps
	     nothing. -->
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

<!-- Two dialogs rather than one carrying a verb: each is a fixed question with
     a fixed handler, which is the API `AlertDialog` fixes on purpose. -->
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
