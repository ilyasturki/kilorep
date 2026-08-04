<script lang="ts">
	import { Drawer } from 'vaul-svelte';

	import type { Entry } from '$lib/workout/groups';
	import SessionList from '$lib/workout/SessionList.svelte';
	import { registerOverlay } from '$lib/ui/overlays';

	type Props = {
		open?: boolean;
		entries: Entry[];
		activeSetId: string | null;
		onjump: (setId: string) => void;
		oninsert: () => void;
		onreorder: (entryId: string, index: number) => void;
		ondrop?: (entryId: string) => void;
	};

	let {
		open = $bindable(false),
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
</script>

<Drawer.Root bind:open direction="left">
	<Drawer.Portal>
		<Drawer.Overlay class="overlay-scrim-drawer" />

		<Drawer.Content class="overlay-panel overlay-drawer-left">
			<div class="px-4 pt-4 pb-0.5">
				<Drawer.Title class="title-panel">Session</Drawer.Title>
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto px-4 pt-1.5 pb-4">
				<SessionList
					{entries}
					{activeSetId}
					{onreorder}
					{ondrop}
					onjump={jump}
					onfocus={onjump}
					oninsert={insert}
				/>
			</div>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>
