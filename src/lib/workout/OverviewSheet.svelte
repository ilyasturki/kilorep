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
	};

	let { open = $bindable(false), groups, activeSetId, onjump }: Props = $props();

	// Jumping is the whole reason the sheet was opened, so it closes behind the
	// tap. The rail, having nothing to close, passes `onjump` straight through —
	// which is why closing lives here and not in `SessionList`.
	function jump(setId: string) {
		onjump(setId);
		open = false;
	}
</script>

<Sheet bind:open title="Session">
	<SessionList {groups} {activeSetId} onjump={jump} />
</Sheet>
