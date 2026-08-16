<script lang="ts">
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import Pencil from '$lib/ui/icons/Pencil.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	type Props = {
		open?: boolean;
		title: string;
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
		Edit entry
	</MenuItem>
	<MenuItem destructive onselect={() => pick(ondelete)}>
		<Trash size={18} />
		Delete entry
	</MenuItem>
</Menu>
