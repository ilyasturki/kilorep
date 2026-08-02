<script lang="ts">
	import Button from '$lib/ui/Button.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';
	import Pencil from '$lib/ui/icons/Pencil.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	/**
	 * What a past workout can be, besides read: corrected, or thrown away.
	 *
	 * The record's own `⋯`, one level above `ExerciseOptionsSheet` and the same
	 * shape as it — a sheet titled after the thing, a short list of what can
	 * happen to it — because the gesture is the same gesture and the levels
	 * differ only in what they act on. It is why the top bar can carry the
	 * screen's action instead of its verbs: a menu costs one tap and buys the
	 * row back.
	 *
	 * Neither action fires from here. Edit is a mode the screen owns, and delete
	 * goes through the screen's confirm — a sheet that destroyed a session on a
	 * tap would be the one place in the app where a record leaves without being
	 * asked about.
	 */
	type Props = {
		open?: boolean;
		title: string;
		onedit: () => void;
		ondelete: () => void;
	};

	let { open = $bindable(false), title, onedit, ondelete }: Props = $props();

	function pick(action: () => void) {
		open = false;
		action();
	}
</script>

<!-- Icons lead the labels, like the exercise sheet: a short stack of verbs is
     read as a menu, and a menu is scanned by glyph before it is read. -->
<Sheet bind:open {title}>
	<div class="flex flex-col gap-2">
		<Button variant="secondary" class="w-full" onclick={() => pick(onedit)}>
			<Pencil size={18} />
			Edit workout
		</Button>
		<Button variant="destructive" class="w-full" onclick={() => pick(ondelete)}>
			<Trash size={18} />
			Delete workout
		</Button>
	</div>
</Sheet>
