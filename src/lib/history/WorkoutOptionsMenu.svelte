<script lang="ts">
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';
	import StackPlus from '$lib/ui/icons/StackPlus.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	type Props = {
		open?: boolean;
		title: string;
		anchor?: HTMLElement | null;
		linked: boolean;
		onlink: () => void;
		/** Absent, there is nothing to save: the workout already has a plan. */
		onsave?: () => void;
		ondelete: () => void;
	};

	let {
		open = $bindable(false),
		title,
		anchor = null,
		linked,
		onlink,
		onsave,
		ondelete
	}: Props = $props();

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
	{#if onsave !== undefined}
		<MenuItem onselect={() => pick(onsave)}>
			<StackPlus size={18} />
			Save as a new plan
		</MenuItem>
	{/if}
	<MenuItem destructive onselect={() => pick(ondelete)}>
		<Trash size={18} />
		Delete workout
	</MenuItem>
</Menu>
