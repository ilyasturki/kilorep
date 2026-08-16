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
	};

	let { heading, entries, activeSetId, onjump, onfocus, oninsert, onreorder, ondrop }: Props =
		$props();
</script>

<div class="px-4 pt-4 pb-0.5">
	{@render heading()}
</div>

<div class="min-h-0 flex-1 overflow-y-auto px-4 pt-1.5 pb-4">
	<SessionList {entries} {activeSetId} {onjump} {onfocus} {oninsert} {onreorder} {ondrop} />
</div>
