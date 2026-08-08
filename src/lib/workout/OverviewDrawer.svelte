<script lang="ts">
	import { Drawer } from 'vaul-svelte';

	import type { Entry } from '$lib/workout/groups';
	import SessionPanel from '$lib/workout/SessionPanel.svelte';
	import { registerOverlay } from '$lib/ui/overlays';

	type Props = {
		open?: boolean;
		/**
		 * Arrive already open, with no entrance of vaul's own.
		 *
		 * Set by the pane when a swipe dragged the stand-in panel all the way in
		 * and this drawer is taking over from it: the panel is at rest on screen
		 * already, and a slide-in from the edge would be it leaving and coming
		 * back. It stays set for as long as this opening lasts, because lifting it
		 * mid-open would hand `animation-name` back to an element in
		 * `[data-state='open']` and replay the slide from nothing. Closing is
		 * untouched either way — the rule in `app.css` answers only for the open
		 * state, so a drawer that arrived silently still leaves normally.
		 */
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

	// Built as strings rather than as a class array: these go through vaul's own
	// prop merge on the way to the element, which joins classes as text.
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
