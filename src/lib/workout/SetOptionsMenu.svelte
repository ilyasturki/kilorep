<script lang="ts">
	import type { SetCursor } from '$lib/domain/workout';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import ArrowCounterClockwise from '$lib/ui/icons/ArrowCounterClockwise.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	type Props = {
		open?: boolean;
		cursor: SetCursor | null;
		anchor?: HTMLElement | null;
		removable: boolean;
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

	const performed = $derived(cursor === null ? '' : `${cursor.set.weight} × ${cursor.set.reps}`);

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
</script>

<Menu bind:open {title} {anchor}>
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
