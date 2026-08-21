<script lang="ts">
	import type { Entry } from '$lib/workout/groups';
	import SessionPanel from '$lib/workout/SessionPanel.svelte';
	import { QUICK_EASE, quickMs } from '$lib/ui/motion';

	// vaul only drags from a pointerdown on its own content; this stand-in covers a
	// swipe starting outside it, and the drawer takes over on release.
	type Props = {
		offset: number;
		width?: number;
		settling: boolean;
		entries: Entry[];
		activeSetId: string | null;
		onsettled: () => void;
	};

	let { offset, width = $bindable(0), settling, entries, activeSetId, onsettled }: Props = $props();

	let panel = $state<HTMLElement | null>(null);

	$effect(() => {
		if (panel !== null) {
			width = panel.offsetWidth;
		}
	});

	const progress = $derived(width > 0 ? Math.min(offset / width, 1) : 0);

	const travel = $derived(settling ? `${quickMs()}ms ${QUICK_EASE}` : '0s');

	function settled(event: TransitionEvent) {
		if (event.propertyName === 'translate') {
			onsettled();
		}
	}
</script>

<div
	class="pointer-events-none overlay-scrim-drawer"
	style:opacity={progress}
	style:transition="opacity {travel}"
	aria-hidden="true"
></div>

<div
	bind:this={panel}
	class="pointer-events-none overlay-panel overlay-drawer-left"
	style:translate="calc({offset}px - 100%) 0"
	style:transition="translate {travel}"
	ontransitionend={settled}
	aria-hidden="true"
>
	<SessionPanel
		{entries}
		{activeSetId}
		onjump={() => {}}
		onfocus={() => {}}
		oninsert={() => {}}
		onreorder={() => {}}
		ondiscard={() => {}}
	>
		{#snippet heading()}
			<h2 class="title-panel">Session</h2>
		{/snippet}
	</SessionPanel>
</div>
