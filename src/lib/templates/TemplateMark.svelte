<script lang="ts">
	import type { TemplateMark } from '$lib/domain/template';
	import { MARK_FILLS, MARK_GLYPHS, MARK_TILES } from '$lib/templates/marks';

	let { mark }: { mark: TemplateMark } = $props();

	const Glyph = $derived(mark.icon === null ? null : MARK_GLYPHS[mark.icon]);

	/**
	 * Three tiles for three marks, and the middle one is why the hue has two
	 * class maps. Glyph and hue is the soft pair, the shape this started as.
	 * Hue alone has nothing to draw *on* the tile, so the tile becomes the mark
	 * and takes the colour at full strength. Glyph alone stays neutral rather
	 * than borrowing a hue nobody picked.
	 */
	function tileFor({ icon, colour }: TemplateMark): string {
		if (colour === null) {
			return 'bg-sunken text-ink-muted';
		}

		return icon === null ? MARK_FILLS[colour] : MARK_TILES[colour];
	}

	const tile = $derived(tileFor(mark));
</script>

<!-- `aria-hidden`, always: the mark is a second way to recognise a row whose
     name is already beside it, so reading it aloud would say the plan's
     identity twice and the second time in a vocabulary — "Push", "Amber" —
     that means nothing to someone who cannot see the tile. The picker is the
     one place the names are spoken, because there they are the choice.

     The tile keeps its 32px whatever the glyph does, and whether there is one.
     Every row on the list is then indented by the same amount or by none at
     all, which is what lets a marked and an unmarked template sit in one
     column without the drag geometry having to know which is which. -->
<span aria-hidden="true" class={['grid size-8 shrink-0 place-items-center rounded-lg', tile]}>
	{#if Glyph !== null}
		<Glyph size={18} />
	{/if}
</span>
