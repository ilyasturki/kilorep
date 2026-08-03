<script lang="ts">
	import type { Planned } from '$lib/templates/plan';
	import Button from '$lib/ui/Button.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';
	import ArrowsLeftRight from '$lib/ui/icons/ArrowsLeftRight.svelte';
	import Eye from '$lib/ui/icons/Eye.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	/**
	 * What a planned exercise can be, besides prescribed: read about, swapped for
	 * another, or taken out of the plan.
	 *
	 * The workout's `ExerciseOptionsSheet` one screen over, restated for this tree
	 * rather than shared. Same three verbs in the same order, deliberately — the
	 * gesture is the same gesture, and the two screens should teach it once — but
	 * that one is built entirely around arithmetic a plan does not have: it counts
	 * logged sets to decide whether swap and remove must ask first, and reads them
	 * off a `Group` of live cursors this tree has no equivalent of. A component
	 * taking both shapes would be two components sharing a name.
	 *
	 * Nothing here confirms. On the workout screen a removal can destroy the only
	 * data that screen holds; here the menu *is* the deliberation — the card's
	 * removal used to be a bare `×` in the header, which is why it asked, and it
	 * is now two taps behind a sheet naming what it is about to act on. A dialog
	 * after that is a third gate on one decision.
	 *
	 * View is a real link, as it is on the workout's sheet, so a desk can
	 * middle-click it. The card's own name is already an anchor to the same page;
	 * the row is here anyway, because a menu that drops a verb its twin carries
	 * reads as the verb being unavailable rather than as it living elsewhere.
	 *
	 * The group is resolved live by the screen rather than snapshotted on open,
	 * the same rule everything else addressed by id on that screen keeps: a sheet
	 * naming a card that has since changed underneath is worse than one naming
	 * nothing.
	 */
	type Props = {
		open?: boolean;
		group: Planned | null;
		onswap: () => void;
		onremove: () => void;
	};

	let { open = $bindable(false), group, onswap, onremove }: Props = $props();

	const name = $derived(group === null ? 'Exercise' : group.meta.name);
</script>

<!-- Icons lead the labels, as on the workout's sheet: a short stack of verbs is
     read as a menu, and a menu is scanned by glyph before it is read. Each row
     closes the sheet on the way out — the swap hands over to the picker, and a
     sheet left standing behind a removal would name a card that is gone. -->
<Sheet bind:open title={name}>
	<div class="flex flex-col gap-2">
		<Button
			variant="secondary"
			class="w-full"
			href={group === null ? undefined : `/exercises/${group.meta.id}`}
			onclick={() => (open = false)}
		>
			<Eye size={18} />
			View exercise
		</Button>
		<Button
			variant="secondary"
			class="w-full"
			onclick={() => {
				open = false;
				onswap();
			}}
		>
			<ArrowsLeftRight size={18} />
			Swap exercise
		</Button>
		<Button
			variant="destructive"
			class="w-full"
			onclick={() => {
				open = false;
				onremove();
			}}
		>
			<Trash size={18} />
			Remove exercise
		</Button>
	</div>
</Sheet>
