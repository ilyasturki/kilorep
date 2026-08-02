<script lang="ts">
	/**
	 * The title row on a panel that is not a dialog — the Select list, the
	 * DatePicker month. Both were the same four lines.
	 *
	 * Only phone bottom panels render this, and none of them carries a CLOSE
	 * any more: picking an item is how these panels are almost always left,
	 * and the scrim tap and the hardware back cover walking away — the same
	 * dismissals the Sheet's drawer trusts. A title alone is still worth a
	 * component, because it is the accessible shape two panels must not drift
	 * apart on.
	 *
	 * Sheet and AlertDialog keep their own headers rather than rendering this
	 * one: their titles are `Dialog.Title` / `AlertDialog.Title`, Bits UI parts
	 * that register the panel's accessible name, and a plain `<h2>` would drop
	 * that wiring. They share the typography through `title-panel` instead,
	 * which is the part that was actually duplicated.
	 */
	type Props = {
		title: string;
	};

	let { title }: Props = $props();
</script>

<div class="px-4 pt-4 pb-2">
	<h2 class="title-panel">{title}</h2>
</div>
