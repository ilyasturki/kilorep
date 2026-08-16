<script lang="ts">
	import type { TemplateMark } from '$lib/domain/template';
	import { MARK_FILLS, MARK_GLYPHS, MARK_TILES } from '$lib/templates/marks';

	let { mark }: { mark: TemplateMark } = $props();

	const Glyph = $derived(mark.icon === null ? null : MARK_GLYPHS[mark.icon]);

	function tileFor({ icon, colour }: TemplateMark): string {
		if (colour === null) {
			return 'bg-sunken text-ink-muted';
		}

		return icon === null ? MARK_FILLS[colour] : MARK_TILES[colour];
	}

	const tile = $derived(tileFor(mark));
</script>

<span aria-hidden="true" class={['grid size-8 shrink-0 place-items-center rounded-lg', tile]}>
	{#if Glyph !== null}
		<Glyph size={18} />
	{/if}
</span>
