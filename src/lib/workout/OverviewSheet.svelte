<script lang="ts">
	import type { Group } from '$lib/workout/groups';
	import SessionList from '$lib/workout/SessionList.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';

	/**
	 * The session list, on a screen with no room to keep it open.
	 *
	 * From `lg` up there is no sheet and no button to open one: the rail holds
	 * the same `SessionList` permanently, so this is the narrow half of one
	 * control rather than a second one. The button opening it lives in the
	 * phone's own header and nowhere else — the rail arrives with the app bar,
	 * because the content cap steps down at `lg` to pay for it (see `app.css`),
	 * so there is no width with the bar up and the rail missing.
	 */
	type Props = {
		open?: boolean;
		groups: Group[];
		activeSetId: string | null;
		onjump: (setId: string) => void;
		oninsert: () => void;
		onreorder: (entryId: string, index: number) => void;
		ondrop?: (entryId: string) => void;
	};

	let {
		open = $bindable(false),
		groups,
		activeSetId,
		onjump,
		oninsert,
		onreorder,
		ondrop
	}: Props = $props();

	// Jumping is the whole reason the sheet was opened, so it closes behind the
	// tap. The rail, having nothing to close, passes `onjump` straight through —
	// which is why closing lives here and not in `SessionList`. Insert closes
	// for one more reason: the insert sheet is about to open, and two sheets
	// stacked is a fight over one focus trap.
	//
	// Reordering does not close it, and the asymmetry is the point: a jump is
	// finished when it lands, and reordering a session is a handful of drags you
	// want to see the result of before leaving. A lift selects the exercise all
	// the same — that is `onfocus`, handed straight down, closing nothing.
	function jump(setId: string) {
		onjump(setId);
		open = false;
	}

	function insert() {
		open = false;
		oninsert();
	}
</script>

<Sheet bind:open title="Session">
	<SessionList
		{groups}
		{activeSetId}
		{onreorder}
		{ondrop}
		onjump={jump}
		onfocus={onjump}
		oninsert={insert}
	/>
</Sheet>
