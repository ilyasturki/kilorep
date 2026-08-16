<script lang="ts">
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import ClockCounterClockwise from '$lib/ui/icons/ClockCounterClockwise.svelte';
	import Eye from '$lib/ui/icons/Eye.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	type Props = {
		open?: boolean;
		title: string;
		anchor?: HTMLElement | null;
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
