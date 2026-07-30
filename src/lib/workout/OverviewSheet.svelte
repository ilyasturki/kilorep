<script lang="ts">
	import type { Group } from '$lib/workout/groups';
	import SessionList from '$lib/workout/SessionList.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';

	/**
	 * The session list, on a screen with no room to keep it open.
	 *
	 * Above `lg` there is no sheet and no button to open one: the rail holds the
	 * same `SessionList` permanently, so this is the small-screen half of one
	 * control rather than a second one.
	 */
	type Props = {
		open?: boolean;
		groups: Group[];
		activeSetId: string | null;
		onjump: (setId: string) => void;
		oninsert: () => void;
	};

	let { open = $bindable(false), groups, activeSetId, onjump, oninsert }: Props = $props();

	// Jumping is the whole reason the sheet was opened, so it closes behind the
	// tap. The rail, having nothing to close, passes `onjump` straight through —
	// which is why closing lives here and not in `SessionList`. Insert closes
	// for one more reason: the insert sheet is about to open, and two sheets
	// stacked is a fight over one focus trap.
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
	<SessionList {groups} {activeSetId} onjump={jump} oninsert={insert} />
</Sheet>
