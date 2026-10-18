<script lang="ts">
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import Pencil from '$lib/ui/icons/Pencil.svelte';
	import Play from '$lib/ui/icons/Play.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';
	import StackPlus from '$lib/ui/icons/StackPlus.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	type Props = {
		open?: boolean;
		title: string;
		anchor?: HTMLElement | null;
		linked: boolean;
		onrepeat?: (() => void) | undefined;
		onedit?: (() => void) | undefined;
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
		onrepeat,
		onedit,
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
	{#if onrepeat}
		<MenuItem onselect={() => pick(onrepeat)}>
			<Play size={18} />
			Repeat workout
		</MenuItem>
	{/if}
	{#if onedit}
		<MenuItem onselect={() => pick(onedit)}>
			<Pencil size={18} />
			Edit workout
		</MenuItem>
	{/if}
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
