<script lang="ts">
	import type { SetCursor } from '$lib/domain/workout';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import ArrowCounterClockwise from '$lib/ui/icons/ArrowCounterClockwise.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	/**
	 * What a set can be, besides logged.
	 *
	 * Reached by long-press on a touch device, by the row's own ⋯ where there is
	 * a mouse, and by right-click either way — `SetRow` already owns all three
	 * and had nothing to hand them to until now. Menu picks the container: a
	 * sheet under a thumb, an anchored list under a pointer.
	 *
	 * Two entries, and neither is always there. Unlog wants a set that is
	 * claiming it happened *and* a screen that has an un-claim to offer; below
	 * it, Remove, which is the row leaving rather than the claim. PRODUCT.md
	 * parks set type, RPE and note behind this same gesture; they land here,
	 * next to these.
	 *
	 * Shared by the live session and history's editor, which is why the first of
	 * those is a question the caller answers rather than something this reaches
	 * for itself.
	 */
	type Props = {
		open?: boolean;
		cursor: SetCursor | null;
		/** The ⋯ (or the row it sits in) that asked — where the anchored menu hangs. */
		anchor?: HTMLElement | null;
		/** False for the only set an exercise has — see `removeSet` in the domain. */
		removable: boolean;
		/**
		 * Taking the check back, where a screen has no better place to put it.
		 *
		 * The live session does not: an expanded editor has no disc to tap and a
		 * logged row's disc is inside the row's own select target, so the menu is
		 * the door. History's editor draws the disc as a button an inch from the
		 * ⋯ that opens this, and hands nothing — a second copy of a one-tap verb,
		 * two taps deeper, is a menu restating the row beside it.
		 */
		onunlog?: () => void;
		onremove: () => void;
	};

	let {
		open = $bindable(false),
		cursor,
		anchor = null,
		removable,
		onunlog,
		onremove
	}: Props = $props();

	let confirming = $state(false);

	const title = $derived(
		cursor === null || cursor.workingIndex < 0 ? 'Warmup' : `Set ${cursor.workingIndex + 1}`
	);

	const logged = $derived(cursor !== null && cursor.set.completed);

	// Named, not "this set": a confirm that does not say what it is about to
	// destroy is a confirm nobody reads.
	const performed = $derived(cursor === null ? '' : `${cursor.set.weight} × ${cursor.set.reps}`);

	/**
	 * An uncompleted set goes without ceremony — nothing is lost, and the loop
	 * does not stop to ask. A logged one is the only data this screen holds, and
	 * there is no undo anywhere in the app, so it gets the one confirm the gym
	 * floor allows.
	 */
	function remove() {
		open = false;

		if (logged) {
			confirming = true;
			return;
		}

		onremove();
	}

	/**
	 * No confirm, where removing the same set has one. Nothing is lost: the
	 * numbers stay on the row and the claim is the only thing taken back, so
	 * this is the undo whose absence is what makes the removal ask.
	 */
	function unlog() {
		open = false;
		onunlog?.();
	}
</script>

<Menu bind:open {title} {anchor}>
	<!-- Only for a set that is claiming something. On an uncompleted row it would
	     be a verb with nothing to undo, and a greyed one would be the menu
	     explaining a state the row already shows. Warmups included: a warmup
	     cannot be tapped in the list but the advance still lands on one, so this
	     is the only door back out of a warmup logged by mistake. -->
	{#if logged && onunlog !== undefined}
		<MenuItem onselect={unlog}>
			<ArrowCounterClockwise size={18} />
			Unlog set
		</MenuItem>
	{/if}

	{#if removable}
		<MenuItem destructive onselect={remove}>
			<Trash size={18} />
			Remove set
		</MenuItem>
	{:else}
		<p class="px-1 py-2 text-md font-bold text-ink-faint">An exercise keeps at least one set.</p>
	{/if}
</Menu>

<AlertDialog
	bind:open={confirming}
	title="Remove {title.toLowerCase()}?"
	description="{performed} is logged, and nothing in the app can put it back."
	confirmLabel="Remove"
	onconfirm={onremove}
/>
