<script lang="ts">
	import type { Snippet } from 'svelte';

	import type { Entry } from '$lib/workout/groups';
	import SessionList from '$lib/workout/SessionList.svelte';

	/**
	 * What is inside the session panel, wherever the panel is coming from.
	 *
	 * There are two of those now: the drawer vaul opens, and the stand-in the
	 * pane drags in under the finger before vaul has been told anything. A swipe
	 * that hands one panel over to the other survives only if the two are the
	 * same pixels, and the only way to be sure of that is for them to be the same
	 * markup — so it lives here and both render it.
	 *
	 * The heading is the one thing that differs, and it is a snippet for that
	 * reason: inside the drawer it has to be vaul's `Drawer.Title`, which is what
	 * names the dialog for a screen reader, and the stand-in is not a dialog and
	 * has nothing to name.
	 */
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
