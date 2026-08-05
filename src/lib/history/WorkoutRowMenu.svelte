<script lang="ts">
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import ClockCounterClockwise from '$lib/ui/icons/ClockCounterClockwise.svelte';
	import Eye from '$lib/ui/icons/Eye.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	/**
	 * What a held row of a past workout can do — the things its detail page
	 * already offers, one gesture earlier. Nothing here is new: Repeat is the
	 * sticky bar at the foot of the record, Delete is the record's own ⋯.
	 *
	 * Two lists hold rows like that and they disagree about what a tap means, so
	 * the menu is what makes up the difference: in History a tap opens the record
	 * and Repeat is the shortcut, on the idle Train screen a tap repeats it and
	 * `href` is what puts Open back within reach. Whichever verb the tap already
	 * spends is simply withheld here rather than listed twice.
	 *
	 * Deliberately not `WorkoutOptionsMenu`. That one belongs to a workout you
	 * are looking at, where Edit is a mode you enter; from a list there is
	 * nothing on screen to edit.
	 */
	type Props = {
		open?: boolean;
		title: string;
		anchor?: HTMLElement | null;
		/** The record's own address, where a tap on the row does not go there. */
		href?: string;
		onrepeat?: () => void;
		ondelete: () => void;
	};

	let { open = $bindable(false), title, anchor = null, href, onrepeat, ondelete }: Props = $props();

	function pick(action: () => void) {
		open = false;
		action();
	}
</script>

<Menu bind:open {title} {anchor}>
	{#if href !== undefined}
		<!-- A real link, the way `PlanOptionsMenu` reaches an exercise: it is a
		     place, not an act, and closing the menu is the whole of this one's job. -->
		<MenuItem {href} onselect={() => (open = false)}>
			<Eye size={18} />
			Open this workout
		</MenuItem>
	{/if}
	{#if onrepeat !== undefined}
		<MenuItem onselect={() => pick(onrepeat)}>
			<ClockCounterClockwise size={18} />
			Repeat this workout
		</MenuItem>
	{/if}
	<MenuItem destructive onselect={() => pick(ondelete)}>
		<Trash size={18} />
		Delete workout
	</MenuItem>
</Menu>
