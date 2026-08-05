<script lang="ts">
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import ClockCounterClockwise from '$lib/ui/icons/ClockCounterClockwise.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	/**
	 * What a held row in the History list can do — the two things its detail page
	 * already offers, one gesture earlier. Nothing here is new: Repeat is the
	 * sticky bar at the foot of the record, Delete is the record's own ⋯.
	 *
	 * Deliberately not `WorkoutOptionsMenu`. That one belongs to a workout you
	 * are looking at, where Edit is a mode you enter; from a list there is
	 * nothing on screen to edit, and Repeat is the verb worth a shortcut.
	 */
	type Props = {
		open?: boolean;
		title: string;
		anchor?: HTMLElement | null;
		onrepeat: () => void;
		ondelete: () => void;
	};

	let { open = $bindable(false), title, anchor = null, onrepeat, ondelete }: Props = $props();

	function pick(action: () => void) {
		open = false;
		action();
	}
</script>

<Menu bind:open {title} {anchor}>
	<MenuItem onselect={() => pick(onrepeat)}>
		<ClockCounterClockwise size={18} />
		Repeat this workout
	</MenuItem>
	<MenuItem destructive onselect={() => pick(ondelete)}>
		<Trash size={18} />
		Delete workout
	</MenuItem>
</Menu>
