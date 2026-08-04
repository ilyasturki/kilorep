<script lang="ts">
	import type { Group } from '$lib/workout/groups';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import ArrowsLeftRight from '$lib/ui/icons/ArrowsLeftRight.svelte';
	import Eye from '$lib/ui/icons/Eye.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	/**
	 * What an exercise can be, besides performed: read about, swapped for
	 * another, or taken out of the session.
	 *
	 * Reached by tapping the exercise's own name in the block, which was the one
	 * part of this screen that said something and did nothing. Menu picks the
	 * container — a sheet under a thumb, an anchored list at the name under a
	 * pointer.
	 *
	 * `SetOptionsMenu` is the same surface one level down, and the two are
	 * deliberately the same shape — titled after the thing, a short list of what
	 * can happen to it — because the gesture is the same gesture and the levels
	 * differ only in what they act on.
	 *
	 * Swap and Remove destroy every set under the exercise, so both go through a
	 * confirm once any of them is logged: that is the only data this screen
	 * holds, and there is no undo anywhere in the app. Untouched, neither asks —
	 * the loop does not stop for a decision that costs nothing. View asks
	 * nothing ever; it changes no data and the way back is the way it came.
	 *
	 * View leads because it is the only one of the three that is not a decision
	 * about the session, and because it is the answer to the question the name
	 * itself raises mid-set — which grip, which machine, what did this lift last
	 * month. It is a real link and not a button running `goto`, so a desk can
	 * middle-click it and the phone's own gestures work on it.
	 *
	 * The group is resolved live by the screen rather than snapshotted on open,
	 * for the reason `SetOptionsMenu` gives: a menu describing a row that has
	 * since moved is worse than one that describes nothing.
	 */
	type Props = {
		open?: boolean;
		group: Group | null;
		/** The name button that asked — where the anchored menu hangs. */
		anchor?: HTMLElement | null;
		onswap: () => void;
		onremove: () => void;
	};

	let { open = $bindable(false), group, anchor = null, onswap, onremove }: Props = $props();

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
</script>

<!-- View closes on the way out rather than being left standing: the navigation
     unmounts the screen behind this menu, and one that was open when its page
     left is one the browser's back button hands back still open. -->
<Menu bind:open title={name} {anchor}>
	<MenuItem
		href={group === null ? undefined : `/exercises/${group.meta.id}`}
		onselect={() => (open = false)}
	>
		<Eye size={18} />
		View exercise
	</MenuItem>
	<MenuItem onselect={swap}>
		<ArrowsLeftRight size={18} />
		Swap exercise
	</MenuItem>
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
