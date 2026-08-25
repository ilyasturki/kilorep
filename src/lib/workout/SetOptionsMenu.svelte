<script lang="ts">
	import { armsOf } from '$lib/domain/workout';
	import type { Arms, SetCursor } from '$lib/domain/workout';
	import { singleArmable } from '$lib/domain/exercise';
	import type { Exercise } from '$lib/domain/exercise';
	import { hasGrips } from '$lib/domain/grip';
	import ArmsField from '$lib/workout/ArmsField.svelte';
	import GripField from '$lib/workout/GripField.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import ArrowCounterClockwise from '$lib/ui/icons/ArrowCounterClockwise.svelte';
	import Backspace from '$lib/ui/icons/Backspace.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	type Props = {
		open?: boolean;
		cursor: SetCursor | null;
		meta?: Exercise;
		anchor?: HTMLElement | null;
		removable: boolean;
		onunlog?: () => void;
		onclear?: () => void;
		onremove: () => void;
		ongrip?: (grip: string) => void;
		onarms?: (arms: Arms) => void;
	};

	let {
		open = $bindable(false),
		cursor,
		meta,
		anchor = null,
		removable,
		onunlog,
		onclear,
		onremove,
		ongrip,
		onarms
	}: Props = $props();

	let confirming = $state(false);
	let wiping = $state(false);

	// Frozen at close, like the exercise menu: removing the set kills the live cursor while
	// the sheet is still sliding out, and the confirm dialogs read from here after it's gone.
	let held: { cursor: SetCursor | null; meta: Exercise | undefined; removable: boolean } = {
		cursor: null,
		meta: undefined,
		removable: false
	};

	const view = $derived.by(() => {
		if (open && cursor !== null) {
			held = { cursor, meta, removable };
		}

		return held;
	});

	const title = $derived(
		view.cursor === null || view.cursor.workingIndex < 0
			? 'Warmup'
			: `Set ${view.cursor.workingIndex + 1}`
	);

	const logged = $derived(view.cursor !== null && view.cursor.set.completed);

	const performed = $derived(
		view.cursor === null ? '' : `${view.cursor.set.weight} × ${view.cursor.set.reps}`
	);

	// Nothing to take back on a set that holds nothing: the card's offer is not the set's, and
	// a row already reading `– × –` would be given a menu item that changes nothing on screen.
	const holds = $derived(
		view.cursor !== null && (view.cursor.set.weight !== null || view.cursor.set.reps !== null)
	);

	const gripped = $derived(hasGrips(view.meta) && ongrip !== undefined);

	const arms = $derived(view.cursor === null ? 'both' : armsOf(view.cursor.set));

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
	{#if view.cursor !== null && onarms !== undefined && singleArmable(view.meta)}
		<ArmsField value={arms} onpick={(next) => onarms(next)} />
	{/if}

	{#if gripped && view.cursor !== null}
		<GripField
			meta={view.meta}
			value={view.cursor.set.grip}
			note="This set only"
			onpick={(g) => ongrip?.(g)}
		/>
	{/if}

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

	{#if view.removable}
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
