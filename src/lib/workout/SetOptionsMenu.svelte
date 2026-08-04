<script lang="ts">
	import type { SetCursor } from '$lib/domain/workout';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	/**
	 * What a set can be, besides logged.
	 *
	 * Reached by long-press on a touch device, by the row's own ⋯ where there is
	 * a mouse, and by right-click either way — `SetRow` already owns all three
	 * and had nothing to hand them to until now. Menu picks the container: a
	 * sheet under a thumb, an anchored list under a pointer.
	 *
	 * Remove is the only entry today, and either container is heavy for one
	 * verb. It holds the slot because PRODUCT.md parks set type, RPE and note
	 * behind exactly this gesture; they land here, next to this.
	 */
	type Props = {
		open?: boolean;
		cursor: SetCursor | null;
		/** The ⋯ (or the row it sits in) that asked — where the anchored menu hangs. */
		anchor?: HTMLElement | null;
		/** False for the only set an exercise has — see `removeSet` in the domain. */
		removable: boolean;
		onremove: () => void;
	};

	let { open = $bindable(false), cursor, anchor = null, removable, onremove }: Props = $props();

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
</script>

<Menu bind:open {title} {anchor}>
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
