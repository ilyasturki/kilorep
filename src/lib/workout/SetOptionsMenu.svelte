<script lang="ts">
	import type { SetCursor } from '$lib/domain/workout';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import ArrowCounterClockwise from '$lib/ui/icons/ArrowCounterClockwise.svelte';
	import Backspace from '$lib/ui/icons/Backspace.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	type Props = {
		open?: boolean;
		cursor: SetCursor | null;
		anchor?: HTMLElement | null;
		removable: boolean;
		onunlog?: () => void;
		onclear?: () => void;
		onremove: () => void;
	};

	let {
		open = $bindable(false),
		cursor,
		anchor = null,
		removable,
		onunlog,
		onclear,
		onremove
	}: Props = $props();

	let confirming = $state(false);
	let wiping = $state(false);

	const title = $derived(
		cursor === null || cursor.workingIndex < 0 ? 'Warmup' : `Set ${cursor.workingIndex + 1}`
	);

	const logged = $derived(cursor !== null && cursor.set.completed);

	const performed = $derived(cursor === null ? '' : `${cursor.set.weight} × ${cursor.set.reps}`);

	// Nothing to take back on a set that holds nothing: the card's offer is not the set's, and
	// a row already reading `– × –` would be given a menu item that changes nothing on screen.
	const holds = $derived(
		cursor !== null && (cursor.set.weight !== null || cursor.set.reps !== null)
	);

	function remove() {
		open = false;

		if (logged) {
			confirming = true;
			return;
		}

		onremove();
	}

	function unlog() {
		open = false;
		onunlog?.();
	}

	// Same trade Remove makes: a logged set's numbers are the one thing here nothing can put
	// back, so the ask is owed. A draft is asked for nothing — it was never a record.
	function clear() {
		open = false;

		if (logged) {
			wiping = true;
			return;
		}

		onclear?.();
	}
</script>

<Menu bind:open {title} {anchor}>
	{#if logged && onunlog !== undefined}
		<MenuItem onselect={unlog}>
			<ArrowCounterClockwise size={18} />
			Unlog set
		</MenuItem>
	{/if}

	{#if holds && onclear !== undefined}
		<MenuItem onselect={clear}>
			<Backspace size={18} />
			Clear set
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

<AlertDialog
	bind:open={wiping}
	title="Clear {title.toLowerCase()}?"
	description="{performed} is logged, and nothing in the app can put it back. The set stays, empty."
	confirmLabel="Clear"
	onconfirm={() => onclear?.()}
/>
