<script lang="ts">
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import Pencil from '$lib/ui/icons/Pencil.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	/**
	 * What a past workout can be, besides read: corrected, or thrown away.
	 *
	 * The record's own `⋯`, one level above `ExerciseOptionsMenu` and the same
	 * shape as it — titled after the thing, a short list of what can happen to
	 * it — because the gesture is the same gesture and the levels differ only
	 * in what they act on. It is why the top bar can carry the screen's action
	 * instead of its verbs: a menu costs one tap and buys the row back.
	 *
	 * Neither action fires from here. Edit is a mode the screen owns, and delete
	 * goes through the screen's confirm — a menu that destroyed a session on a
	 * tap would be the one place in the app where a record leaves without being
	 * asked about.
	 */
	type Props = {
		open?: boolean;
		title: string;
		/** The top bar's ⋯ that asked — where the anchored menu hangs. */
		anchor?: HTMLElement | null;
		onedit: () => void;
		ondelete: () => void;
	};

	let { open = $bindable(false), title, anchor = null, onedit, ondelete }: Props = $props();

	function pick(action: () => void) {
		open = false;
		action();
	}
</script>

<Menu bind:open {title} {anchor}>
	<MenuItem onselect={() => pick(onedit)}>
		<Pencil size={18} />
		Edit workout
	</MenuItem>
	<MenuItem destructive onselect={() => pick(ondelete)}>
		<Trash size={18} />
		Delete workout
	</MenuItem>
</Menu>
