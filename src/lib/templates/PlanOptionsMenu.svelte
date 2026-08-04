<script lang="ts">
	import type { Planned } from '$lib/templates/plan';
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import ArrowsLeftRight from '$lib/ui/icons/ArrowsLeftRight.svelte';
	import ArrowsMerge from '$lib/ui/icons/ArrowsMerge.svelte';
	import ArrowsSplit from '$lib/ui/icons/ArrowsSplit.svelte';
	import Eye from '$lib/ui/icons/Eye.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	/**
	 * What a planned exercise can be, besides prescribed: read about, swapped for
	 * another, paired into a superset, or taken out of the plan.
	 *
	 * The workout's `ExerciseOptionsMenu` one screen over, restated for this tree
	 * rather than shared. Same verbs in the same order, deliberately — the gesture
	 * is the same gesture, and the two screens should teach it once — but that one
	 * is built entirely around arithmetic a plan does not have: it counts logged
	 * sets to decide whether swap and remove must ask first, and reads them off a
	 * `Group` of live cursors this tree has no equivalent of. A component taking
	 * both shapes would be two components sharing a name.
	 *
	 * Nothing here confirms. On the workout screen a removal can destroy the only
	 * data that screen holds; here the menu *is* the deliberation — the card's
	 * removal used to be a bare `×` in the header, which is why it asked, and it
	 * is now two taps behind a menu naming what it is about to act on. A dialog
	 * after that is a third gate on one decision.
	 *
	 * View is a real link, as it is on the workout's menu, so a desk can
	 * middle-click it. The card's own name is already an anchor to the same page;
	 * the row is here anyway, because a menu that drops a verb its twin carries
	 * reads as the verb being unavailable rather than as it living elsewhere.
	 *
	 * The group is resolved live by the screen rather than snapshotted on open,
	 * the same rule everything else addressed by id on that screen keeps: a menu
	 * naming a card that has since changed underneath is worse than one naming
	 * nothing.
	 */
	type Props = {
		open?: boolean;
		group: Planned | null;
		/**
		 * Whether the entry this exercise is planned in holds more than one — which
		 * decides whether the pairing item offers to make a superset or to break the
		 * one it is already part of. Never both, the workout menu's rule.
		 */
		superset: boolean;
		/** The card's ⋯ that asked — where the anchored menu hangs. */
		anchor?: HTMLElement | null;
		onswap: () => void;
		onsuperset: () => void;
		onbreak: () => void;
		onremove: () => void;
	};

	let {
		open = $bindable(false),
		group,
		superset,
		anchor = null,
		onswap,
		onsuperset,
		onbreak,
		onremove
	}: Props = $props();

	const name = $derived(group === null ? 'Exercise' : group.meta.name);

	// The one pairing act this entry can be offered — never both. Which of the
	// two it is follows from the entry, the workout menu's rule.
	const pairing = $derived(superset ? onbreak : onsuperset);
</script>

<!-- Each verb closes the menu on the way out — the swap hands over to the
     picker, and a menu left standing behind a removal would name a card that
     is gone. -->
<Menu bind:open title={name} {anchor}>
	<MenuItem
		href={group === null ? undefined : `/exercises/${group.meta.id}`}
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
	<!-- Between the slot-preserving acts and the destructive one, exactly where
	     the workout's menu puts it, so the two screens read as one menu. -->
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
