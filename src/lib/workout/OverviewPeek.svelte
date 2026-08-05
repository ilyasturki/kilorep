<script lang="ts">
	import type { Entry } from '$lib/workout/groups';
	import SessionPanel from '$lib/workout/SessionPanel.svelte';
	import { QUICK_EASE, quickMs } from '$lib/ui/motion';

	/**
	 * The session panel while the finger is still deciding.
	 *
	 * vaul only ever starts a drag from a pointer that went down on its own
	 * content, and it owns the panel's transform for as long as it is open — so a
	 * gesture that begins out on the pane, over a set row, cannot be handed to
	 * it. This is that gesture's panel: the same `SessionPanel` in the same skin,
	 * translated by however far the swipe has travelled, painting nothing else.
	 * On release it slides the rest of the way and the real drawer takes over at
	 * the exact position this one reached — see `instant` on `OverviewDrawer`.
	 *
	 * `pointer-events-none` throughout, on both the scrim and the panel: the
	 * pointer this is following belongs to the pane, which captured it, and a
	 * panel arriving under a moving finger must not start answering it. Nothing
	 * here is reachable and nothing here is announced — the drawer this hands
	 * over to is the dialog, with the focus trap and the title.
	 */
	type Props = {
		/** How far in the panel is pulled, in pixels from its own left edge. */
		offset: number;
		/** Its rendered width, measured rather than restated from the stylesheet. */
		width?: number;
		/** Whether `offset` is being animated to its resting value right now. */
		settling: boolean;
		entries: Entry[];
		activeSetId: string | null;
		onsettled: () => void;
	};

	let { offset, width = $bindable(0), settling, entries, activeSetId, onsettled }: Props = $props();

	let panel = $state<HTMLElement | null>(null);

	// Read after the DOM update and before the paint, so the first frame the user
	// sees already has the real number in it. `min(80vw, 20rem)` lives in
	// `app.css` and is not repeated here; a peek that computed its own width
	// would be a second place for that rule to be changed and forgotten.
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
	<!-- Nothing in here can be tapped, so the handlers are the honest shape of
	     that: this panel is a picture of the session for as long as the swipe
	     lasts, and every act it appears to offer belongs to the drawer behind. -->
	<SessionPanel
		{entries}
		{activeSetId}
		onjump={() => {}}
		onfocus={() => {}}
		oninsert={() => {}}
		onreorder={() => {}}
	>
		{#snippet heading()}
			<h2 class="title-panel">Session</h2>
		{/snippet}
	</SessionPanel>
</div>
