<script lang="ts">
	import type { TemplateMark } from '$lib/domain/template';
	import { MARK_FILLS, MARK_GLYPHS, MARK_TILES } from '$lib/templates/marks';

	let { mark }: { mark: TemplateMark | null } = $props();

	const Glyph = $derived(mark === null || mark.icon === null ? null : MARK_GLYPHS[mark.icon]);

	function tileFor(drawn: TemplateMark | null): string {
		if (drawn === null || drawn.colour === null) {
			return 'bg-sunken text-ink-muted';
		}

		return drawn.icon === null ? MARK_FILLS[drawn.colour] : MARK_TILES[drawn.colour];
	}

	const tile = $derived(tileFor(mark));
</script>

<span aria-hidden="true" class={['grid size-8 shrink-0 place-items-center rounded-lg', tile]}>
	{#if Glyph !== null}
		<Glyph size={18} />
	{/if}
</span>
