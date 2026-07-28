<script lang="ts">
	import Button from '$lib/ui/Button.svelte';

	/**
	 * The title row on a panel that is not a dialog — the Select list, the
	 * DatePicker month. Both were the same four lines, down to the CLOSE button.
	 *
	 * Sheet and AlertDialog keep their own headers rather than rendering this
	 * one: their titles are `Dialog.Title` / `AlertDialog.Title`, Bits UI parts
	 * that register the panel's accessible name, and a plain `<h2>` would drop
	 * that wiring. They share the typography through `title-panel` instead,
	 * which is the part that was actually duplicated.
	 */
	type Props = {
		title: string;
		onclose: () => void;
	};

	let { title, onclose }: Props = $props();
</script>

<div class="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
	<h2 class="title-panel">{title}</h2>
	<Button variant="chrome" caps onclick={onclose}>CLOSE</Button>
</div>
