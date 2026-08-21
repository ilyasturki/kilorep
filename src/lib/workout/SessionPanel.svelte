<script lang="ts">
	import type { Snippet } from 'svelte';

	import type { Entry } from '$lib/workout/groups';
	import SessionList from '$lib/workout/SessionList.svelte';

	type Props = {
		heading: Snippet;
		entries: Entry[];
		activeSetId: string | null;
		onjump: (setId: string) => void;
		onfocus: (setId: string) => void;
		oninsert: () => void;
		onreorder: (entryId: string, index: number) => void;
		ondrop?: (entryId: string) => void;
		ondiscard?: () => void;
		gripOnly?: boolean;
	};

	let {
		heading,
		entries,
		activeSetId,
		onjump,
		onfocus,
		oninsert,
		onreorder,
		ondrop,
		ondiscard,
		gripOnly = false
	}: Props = $props();
</script>

<div class="px-4 pt-4 pb-0.5">
	{@render heading()}
</div>

<!-- `touch-pan-y` has to sit on the scroller, not on the drawer: `touch-action` intersects from the
     touched element up to it only, so the drawer's own `touch-action: none` is never read down here.
     Without it the browser claims a sideways swipe as a pan, cancels the pointer two moves in, and
     vaul's drag-to-dismiss dies before it has moved a pixel. -->
<div class="min-h-0 flex-1 touch-pan-y overflow-y-auto px-4 pt-1.5 pb-4">
	<SessionList
		{entries}
		{activeSetId}
		{onjump}
		{onfocus}
		{oninsert}
		{onreorder}
		{ondrop}
		{ondiscard}
		{gripOnly}
	/>
</div>
