<script lang="ts">
	import type { TemplateMark } from '$lib/domain/template';
	import { MARK_GLYPHS, MARK_TILES } from '$lib/templates/marks';

	let { mark }: { mark: TemplateMark } = $props();

	const Glyph = $derived(MARK_GLYPHS[mark.icon]);
</script>

<!-- `aria-hidden`, always: the mark is a second way to recognise a row whose
     name is already beside it, so reading it aloud would say the plan's
     identity twice and the second time in a vocabulary — "Push", "Amber" —
     that means nothing to someone who cannot see the tile. The picker is the
     one place the names are spoken, because there they are the choice.

     The tile keeps its 32px whatever the glyph does. Every row on the list is
     then indented by the same amount or by none at all, which is what lets a
     marked and an unmarked template sit in one column without the drag
     geometry having to know which is which. -->
<span
	aria-hidden="true"
	class={['grid size-8 shrink-0 place-items-center rounded-lg', MARK_TILES[mark.colour]]}
>
	<Glyph size={18} />
</span>
