<script lang="ts">
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	type Props = {
		open?: boolean;
		title: string;
		anchor?: HTMLElement | null;
		linked: boolean;
		onlink: () => void;
		ondelete: () => void;
	};

	let { open = $bindable(false), title, anchor = null, linked, onlink, ondelete }: Props = $props();

	function pick(action: () => void) {
		open = false;
		action();
	}
</script>

<Menu bind:open {title} {anchor}>
	<MenuItem onselect={() => pick(onlink)}>
		<Stack size={18} />
		{linked ? 'Change plan' : 'Link to a plan'}
	</MenuItem>
	<MenuItem destructive onselect={() => pick(ondelete)}>
		<Trash size={18} />
		Delete workout
	</MenuItem>
</Menu>
