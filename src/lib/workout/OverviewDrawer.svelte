<script lang="ts">
	import { Drawer } from 'vaul-svelte';

	import type { Entry } from '$lib/workout/groups';
	import SessionPanel from '$lib/workout/SessionPanel.svelte';
	import { registerOverlay } from '$lib/ui/overlays';

	type Props = {
		open?: boolean;
		instant?: boolean;
		entries: Entry[];
		activeSetId: string | null;
		onjump: (setId: string) => void;
		oninsert: () => void;
		onreorder: (entryId: string, index: number) => void;
		ondrop?: (entryId: string) => void;
	};

	let {
		open = $bindable(false),
		instant = false,
		entries,
		activeSetId,
		onjump,
		oninsert,
		onreorder,
		ondrop
	}: Props = $props();

	$effect(() => {
		if (!open) {
			return;
		}
		return registerOverlay(() => (open = false));
	});

	function jump(setId: string) {
		onjump(setId);
		open = false;
	}

	function insert() {
		open = false;
		oninsert();
	}

	// Strings, not class arrays: vaul's prop merge joins classes as text.
	const scrim = $derived(instant ? 'overlay-scrim-drawer drawer-instant' : 'overlay-scrim-drawer');
	const panel = $derived(
		instant
			? 'overlay-panel overlay-drawer-left drawer-instant'
			: 'overlay-panel overlay-drawer-left'
	);
</script>

<Drawer.Root bind:open direction="left">
	<Drawer.Portal>
		<Drawer.Overlay class={scrim} />

		<Drawer.Content class={panel}>
			<SessionPanel
				{entries}
				{activeSetId}
				{onreorder}
				{ondrop}
				gripOnly
				onjump={jump}
				onfocus={onjump}
				oninsert={insert}
			>
				{#snippet heading()}
					<Drawer.Title class="title-panel">Session</Drawer.Title>
				{/snippet}
			</SessionPanel>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>
