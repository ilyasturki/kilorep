<script lang="ts">
	import type { Group } from '$lib/workout/groups';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';

	/**
	 * What an exercise can be, besides performed: swapped for another, or taken
	 * out of the session.
	 *
	 * Reached by tapping the exercise's own name in the block, which was the one
	 * part of this screen that said something and did nothing.
	 *
	 * `SetOptionsSheet` is the same surface one level down, and the two are
	 * deliberately the same shape — a sheet titled after the thing, a short list
	 * of what can happen to it — because the gesture is the same gesture and the
	 * levels differ only in what they act on.
	 *
	 * Both actions destroy every set under the exercise, so both go through a
	 * confirm once any of them is logged: that is the only data this screen
	 * holds, and there is no undo anywhere in the app. Untouched, neither asks —
	 * the loop does not stop for a decision that costs nothing.
	 *
	 * The group is resolved live by the screen rather than snapshotted on open,
	 * for the reason `SetOptionsSheet` gives: a sheet describing a row that has
	 * since moved is worse than one that describes nothing.
	 */
	type Props = {
		open?: boolean;
		group: Group | null;
		onswap: () => void;
		onremove: () => void;
	};

	let { open = $bindable(false), group, onswap, onremove }: Props = $props();

	let confirmingSwap = $state(false);
	let confirmingRemove = $state(false);

	const name = $derived(group === null ? 'Exercise' : group.meta.name);

	const logged = $derived(
		group === null ? 0 : group.cursors.filter((cursor) => cursor.set.completed).length
	);

	// Counted and named, not "this exercise": a confirm that does not say what it
	// is about to destroy is a confirm nobody reads. Same rule the set-level
	// sheet keeps, which spells out the numbers it is about to throw away.
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

<Sheet bind:open title={name}>
	<div class="flex flex-col gap-2">
		<Button variant="secondary" class="w-full" onclick={swap}>Swap exercise</Button>
		<Button variant="destructive" class="w-full" onclick={remove}>Remove exercise</Button>
	</div>
</Sheet>

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
